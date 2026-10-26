import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { localDate, localMonth, shiftMonth } from '../../src/lib/dates';
import { emptyLedger } from '../../src/lib/ledger';
function fixture() {
  const ledger = emptyLedger();
  ledger.accounts = [
    {
      id: 'usd',
      name: 'NSave',
      currency: 'USD',
      type: 'bank',
      openingBalanceMinor: 100000,
      color: '#ff9a72',
      createdAt: localDate(),
    },
    {
      id: 'bdt',
      name: 'Local Bank',
      currency: 'BDT',
      type: 'bank',
      openingBalanceMinor: 10000000,
      color: '#6ee7a8',
      createdAt: localDate(),
    },
  ];
  ledger.exchangeRates = [
    { id: 'rate', fromCurrency: 'USD', toCurrency: 'BDT', rate: 120, updatedAt: localDate() },
  ];
  ledger.subscriptions = [
    {
      id: 'sub',
      name: 'Work tool',
      amountMinor: 2000,
      currency: 'USD',
      billingCycle: 'monthly',
      nextBillingDate: localDate(),
      categoryId: 'work-tools',
      accountId: 'usd',
      active: true,
      createdAt: localDate(),
    },
  ];
  ledger.budgets = [
    {
      id: 'budget',
      categoryId: 'groceries',
      month: localMonth(),
      limitMinor: 2000000,
      currency: 'BDT',
    },
  ];
  ledger.goals = [
    {
      id: 'goal',
      name: 'Emergency fund',
      targetMinor: 3000000,
      currentMinor: 1000000,
      currency: 'BDT',
      accountId: 'bdt',
      deadline: `${shiftMonth(localMonth(), 6)}-01`,
      createdAt: localDate(),
    },
  ];
  ledger.transactions = [
    {
      id: 'fixture-income',
      accountId: 'usd',
      categoryId: 'client-payment',
      transferId: null,
      type: 'income',
      amountMinor: 150000,
      currency: 'USD',
      merchant: 'Fixture client',
      note: '',
      date: localDate(),
      tags: [],
      paymentMethod: 'Manual',
      status: 'done',
      createdAt: localDate(),
      reportingRate: 120,
    },
    {
      id: 'fixture-expense',
      accountId: 'bdt',
      categoryId: 'groceries',
      transferId: null,
      type: 'expense',
      amountMinor: 100000,
      currency: 'BDT',
      merchant: 'Fixture groceries',
      note: '',
      date: localDate(),
      tags: [],
      paymentMethod: 'Manual',
      status: 'done',
      createdAt: localDate(),
      reportingRate: 120,
    },
    {
      id: 'fixture-history',
      accountId: 'bdt',
      categoryId: 'rent',
      transferId: null,
      type: 'expense',
      amountMinor: 1500000,
      currency: 'BDT',
      merchant: 'Fixture rent',
      note: '',
      date: `${shiftMonth(localMonth(), -1)}-01`,
      tags: [],
      paymentMethod: 'Manual',
      status: 'done',
      createdAt: localDate(),
      reportingRate: 120,
    },
  ];
  return ledger;
}
// Interaction tests run against a per-test stand-in for /api/db that applies the
// same revision rules as the real handler. API and refresh cases use the real vault.
let db: { revision: number; data: ReturnType<typeof fixture> };
test.beforeEach(async ({ page, context }) => {
  db = { revision: 1, data: fixture() };
  const signedIn = await page.request.post('/api/auth/session', {
    headers: { Origin: 'http://localhost:3100' },
    data: { password: 'ember-e2e-only-owner-password' },
  });
  expect(signedIn.status()).toBe(200);
  await context.route('**/api/db', async (route) => {
    if (route.request().method() === 'POST') {
      const sent = route.request().postDataJSON();
      if (sent.expectedRevision !== db.revision) {
        await route.fulfill({ status: 409, json: { error: 'Stale revision' } });
        return;
      }
      db = { revision: db.revision + 1, data: sent.data };
      await route.fulfill({ json: { revision: db.revision, provider: 'file' } });
      return;
    }
    await route.fulfill({ json: { data: db.data, revision: db.revision, provider: 'file' } });
  });
});
const browserLedgerKeys = (page: Page) =>
  page.evaluate(() =>
    Object.keys(localStorage).filter((key) => /ledger|recovery|personal_workspace/.test(key)),
  );

test('cached records remain hidden when the session endpoint cannot verify access', async ({
  page,
}) => {
  await page.route('**/api/auth/session', (route) => route.abort());
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main h1')).toHaveText('Could not verify sign-in');
  await expect(page.getByText('NSave', { exact: true })).toHaveCount(0);
});

test('a failed server sign-out stays visible and does not claim success', async ({ page }) => {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: route.request().method() === 'DELETE' ? 503 : 200,
      json: {
        configured: true,
        authenticated: true,
        expiresAt: Date.now() + 12 * 3600000,
      },
    }),
  );
  await page.goto('/settings');
  const settingsSignOut = page.locator('#workspace-content').getByRole('button', {
    name: 'Sign out',
    exact: true,
  });
  await settingsSignOut.click();
  await expect(
    page.getByText('Could not sign out of the server. Please retry.', { exact: true }),
  ).toBeVisible();
  await expect(settingsSignOut).toBeVisible();
  await expect(
    page.getByText('Signed out. This browser still contains your local records.', { exact: true }),
  ).toHaveCount(0);
});

test('an open dashboard refreshes its month and totals after the Dhaka calendar changes', async ({
  page,
}) => {
  const next = new Date(`${shiftMonth(localMonth(), 1)}-01T00:01:00+06:00`);
  const before = new Date(next.getTime() - 120000);
  await page.clock.setFixedTime(before);
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      json: {
        configured: true,
        authenticated: true,
        expiresAt: before.getTime() + 12 * 3600000,
      },
    }),
  );
  await page.goto('/dashboard');
  await expect(page.locator('main h1')).toBeVisible();
  await page.getByRole('button', { name: 'USD', exact: true }).click();
  const income = page
    .getByText('Income this month', { exact: true })
    .locator('..')
    .locator('.text-money');
  await expect(income).toHaveText('$1,500');
  await page.clock.setFixedTime(next);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(income).toHaveText('$0');
  await expect(page.locator('.dashboard-intro .label-uppercase')).toHaveText(
    new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Dhaka',
      month: 'long',
      year: 'numeric',
    }).format(next),
  );
});

test('returning to the tab shows preferences changed on another device', async ({ page }) => {
  await page.goto('/coach');
  await expect(page.getByText('Target: Your target: 20%', { exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  const changed = structuredClone(db.data);
  changed.settings.savingsTargetPercent = 35;
  db = { revision: db.revision + 1, data: changed };
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('Target: Your target: 35%', { exact: true })).toBeVisible();
});

test('all pages hydrate without runtime errors and fit desktop, tablet, and phone', async ({
  page,
}) => {
  // This visits 30 pages; allow for slower local machines running a dev server too.
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      'dashboard',
      'transactions',
      'accounts',
      'allocations',
      'subscriptions',
      'budgets',
      'goals',
      'reports',
      'coach',
      'settings',
    ]) {
      await page.goto('/' + route, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`/${route}$`));
      await expect(page.locator('main h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width + 1);
      if (
        process.env.EMBER_CAPTURE_VERIFICATION === 'true' &&
        width !== 768 &&
        ['dashboard', 'accounts', 'allocations'].includes(route)
      ) {
        fs.mkdirSync('artifacts/verification/screenshots', { recursive: true });
        await page.screenshot({
          path: `artifacts/verification/screenshots/${route}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
  expect(errors).toEqual([]);
});
test('records are read from the database and never stored in the browser', async ({ page }) => {
  await page.goto('/accounts');
  await expect(page.getByText('Local Bank', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Local Bank' }).click();
  await page.getByRole('dialog').getByLabel('Account name').fill('Renamed Bank');
  await page.getByRole('dialog').getByRole('button', { name: 'Save account' }).click();
  await expect.poll(() => db.data.accounts.find((a) => a.id === 'bdt')?.name).toBe('Renamed Bank');
  expect(await browserLedgerKeys(page)).toEqual([]);
  await page.reload();
  await expect(page.getByText('Renamed Bank', { exact: true })).toBeVisible();
});

test('existing future-dated postings open with a review notice instead of blocking startup', async ({
  page,
}) => {
  const futureDate = `${shiftMonth(localMonth(), 1)}-01`;
  {
    const date = futureDate;
    const state = { ledger: db.data };
    state.ledger.transactions[0].date = date;
    state.ledger.transfers.push({
      id: 'legacy-future-transfer',
      fromAccountId: 'usd',
      toAccountId: 'bdt',
      amountOutMinor: 10000,
      amountInMinor: 1200000,
      exchangeRate: 120,
      feeMinor: 500,
      feeCurrency: 'USD',
      date,
      createdAt: date,
    });
  }
  await page.goto('/accounts');
  await expect(
    page.getByRole('heading', { name: 'Accounts & transfers', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: '2 future-dated records are marked done' }),
  ).toBeVisible();
  // Opening the workspace must not rewrite the stored records.
  expect(db.revision).toBe(1);
  const saved = db.data;
  expect(saved.transactions[0].date).toBe(futureDate);
  expect(saved.transactions[0].status).toBe('done');
  expect(saved.transfers[0].status).toBeUndefined();
  await page.goto('/transactions');
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Fixture client' })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});

test('signed-in startup reads the vault without uploading unchanged records or requesting AI', async ({
  page,
}) => {
  const sent: { url: string; method: string }[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/db') || r.url().includes('/api/ai/'))
      sent.push({ url: r.url(), method: r.method() });
  });
  await page.goto('/coach');
  await expect(page.getByRole('heading', { name: 'Current observations' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(sent.some((r) => r.url.includes('/api/db') && r.method === 'GET')).toBe(true);
  expect(sent.filter((r) => r.url.includes('/api/ai/') || r.method !== 'GET')).toEqual([]);
});
test('quick add opens a labeled dialog, keeps focus, and saves in account currency', async ({
  page,
}) => {
  await page.goto('/transactions?quickAdd=1');
  const dialog = page.getByRole('dialog', { name: 'Record activity' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Account', exact: true }).selectOption('bdt');
  await dialog.getByLabel('Merchant / payee').fill('Market');
  await dialog.getByLabel('Amount (BDT)').fill('1200');
  await dialog.getByRole('combobox', { name: 'Category', exact: true }).selectOption('groceries');
  await dialog.getByRole('button', { name: 'Save activity' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Edit Market' })).toBeVisible();
  await expect.poll(() => db.data.transactions.some((t) => t.merchant === 'Market')).toBe(true);
  const tx = db.data.transactions.find((t) => t.merchant === 'Market')!;
  expect(tx.currency).toBe('BDT');
  expect(tx.amountMinor).toBe(120000);
  await page.getByRole('button', { name: 'Add activity', exact: true }).last().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});
test('recording activity can use a suggested category or create a new one', async ({ page }) => {
  db.data.categories = db.data.categories.filter((c) => c.id !== 'salary');
  await page.goto('/transactions?quickAdd=1');
  const dialog = page.getByRole('dialog', { name: 'Record activity' });
  await dialog.getByRole('combobox', { name: 'Type', exact: true }).selectOption('income');
  await dialog.getByRole('combobox', { name: 'Account', exact: true }).selectOption('bdt');
  await dialog.getByLabel('Client / payer').fill('Employer');
  await dialog.getByLabel('Amount (BDT)').fill('50000');
  await dialog
    .getByRole('combobox', { name: 'Category', exact: true })
    .selectOption({ label: 'Salary' });
  await dialog.getByRole('button', { name: 'Save activity' }).click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(() => db.data.transactions.find((t) => t.merchant === 'Employer')?.categoryId)
    .toBe('salary');
  expect(db.data.categories.filter((c) => c.id === 'salary')).toHaveLength(1);

  await page.getByRole('button', { name: 'Add activity', exact: true }).last().click();
  await dialog.getByRole('combobox', { name: 'Account', exact: true }).selectOption('bdt');
  await dialog.getByLabel('Merchant / payee').fill('Vet clinic');
  await dialog.getByLabel('Amount (BDT)').fill('800');
  await dialog
    .getByRole('combobox', { name: 'Category', exact: true })
    .selectOption({ label: '+ New category…' });
  await dialog.getByLabel('New expense category').fill('Pets');
  await dialog.getByRole('button', { name: 'Save activity' }).click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(() => {
      const pets = db.data.categories.find((c) => c.name === 'Pets');
      return (
        pets &&
        db.data.transactions.find((t) => t.merchant === 'Vet clinic')?.categoryId === pets.id
      );
    })
    .toBe(true);
});
test('transfer records both principal legs and fees, previews balances, and can be corrected', async ({
  page,
}) => {
  await page.goto('/accounts');
  await page.getByRole('button', { name: 'Transfer / convert', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('From account').selectOption('usd');
  await dialog.getByLabel('To account').selectOption('bdt');
  await dialog.getByLabel('Principal sent (USD)').fill('100');
  await dialog.getByLabel(/Actual principal received/).fill('12000');
  await dialog.getByLabel('Additional fee').fill('');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Additional fee').fill('5');
  await expect(dialog.getByText('NSave debit: $105')).toBeVisible();
  await dialog.getByRole('button', { name: 'Record transfer' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => db.data.transfers.length).toBe(1);
  const s = db.data;
  expect(s.transfers).toHaveLength(1);
  expect(s.transfers[0].amountOutMinor).toBe(10000);
  expect(s.transfers[0].amountInMinor).toBe(1200000);
  await page.goto('/transactions');
  // The ledger shows each transfer as one "From → To" row plus its fee as an expense.
  await expect(page.getByRole('link', { name: 'Open transfer: Transfer fee' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open transfer: .+ → Local Bank/ })).toBeVisible();
});
test('goal reservations cannot claim more than the source account holds', async ({ page }) => {
  await page.goto('/goals');
  await page.getByRole('button', { name: 'Update reserved amount' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Total amount to reserve now').fill('1000000');
  await dialog.getByRole('button', { name: 'Save goal' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Insufficient');
  await expect(dialog).toBeVisible();
});
test('invalid restore is rejected, a valid backup previews and then replaces the database copy', async ({
  page,
}) => {
  await page.goto('/settings');
  await page.getByLabel('Preview a JSON backup').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"accounts":[{"id":"broken"}]}'),
  });
  await expect(page.locator('main').getByRole('alert')).toBeVisible();
  await page.getByLabel('Preview a JSON backup').setInputFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture())),
  });
  await expect(page.getByText(/Valid backup: 2 accounts/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restore this backup' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Restore this backup' }).click();
  await expect(
    page.getByText('Backup restored. Review account balances before continuing.'),
  ).toBeVisible();
  expect(db.revision).toBe(2);
  expect(db.data.accounts.map((a) => a.id)).toEqual(['usd', 'bdt']);
});
test('a change from a stale second tab is rejected and that tab shows the saved records', async ({
  page,
  context,
}) => {
  await page.goto('/accounts');
  const second = await context.newPage();
  await second.goto('/accounts');
  await expect(second.getByText('Local Bank', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Local Bank' }).click();
  await page.getByRole('dialog').getByLabel('Account name').fill('First tab name');
  await page.getByRole('dialog').getByRole('button', { name: 'Save account' }).click();
  await expect.poll(() => db.data.accounts[1].name).toBe('First tab name');
  await second.getByRole('button', { name: 'Edit Local Bank' }).click();
  await second.getByRole('dialog').getByLabel('Account name').fill('Second tab name');
  await second.getByRole('dialog').getByRole('button', { name: 'Save account' }).click();
  await expect(second.getByText('First tab name', { exact: true })).toBeVisible();
  await expect(
    second.getByRole('alert').filter({ hasText: 'another device or tab' }),
  ).toBeVisible();
  expect(db.data.accounts[1].name).toBe('First tab name');
  await second.close();
});
test('API rejects anonymous and cross-origin writes; owner sync rejects stale revisions', async ({
  request,
}) => {
  expect((await request.get('/api/db')).status()).toBe(401);
  expect((await request.delete('/api/db')).status()).toBe(401);
  const origin = 'http://localhost:3100';
  const login = await request.post('/api/auth/session', {
    headers: { Origin: origin },
    data: { password: 'ember-e2e-only-owner-password' },
  });
  expect(login.status()).toBe(200);
  const cloud = await (await request.get('/api/db')).json();
  const data = fixture();
  expect(
    (
      await request.post('/api/db', {
        headers: { Origin: 'https://attacker.example' },
        data: { expectedRevision: cloud.revision, data },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/api/db', {
        headers: { Origin: origin },
        data: { expectedRevision: cloud.revision, data },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post('/api/db', {
        headers: { Origin: origin },
        data: { expectedRevision: cloud.revision, data: emptyLedger() },
      })
    ).status(),
  ).toBe(409);
  expect(
    (await request.post('/api/ai/parse', { headers: { Origin: origin }, data: {} })).status(),
  ).toBe(400);
});
test('core pages have no automatically detected WCAG AA violations', async ({ page }) => {
  test.setTimeout(120000);
  for (const route of [
    'dashboard',
    'transactions',
    'accounts',
    'allocations',
    'subscriptions',
    'budgets',
    'goals',
    'reports',
    'coach',
    'settings',
  ]) {
    await page.goto('/' + route, { waitUntil: 'networkidle' });
    await expect(page.locator('main h1')).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
      route,
    ).toEqual([]);
  }
  await page.goto('/settings', { waitUntil: 'networkidle' });
  await page.getByText('Background & appearance', { exact: true }).click();
  // The page header was checked above at the top of the page. Check the newly
  // exposed controls here: offscreen headers over a fixed image otherwise get
  // an unrelated background sampled by the contrast engine after scrolling.
  const appearance = await new AxeBuilder({ page })
    .include('details[open]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    appearance.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
});
test('with the real database, edits made elsewhere appear when returning to the tab', async ({
  page,
  context,
}) => {
  await context.unroute('**/api/db');
  const origin = 'http://localhost:3100';
  const write = async (name: string) => {
    const current = await (await page.request.get('/api/db')).json();
    const data = fixture();
    data.accounts[0].name = name;
    const saved = await page.request.post('/api/db', {
      headers: { Origin: origin },
      data: { expectedRevision: current.revision, data },
    });
    expect(saved.status()).toBe(200);
  };
  await write('Cloud NSave');
  await page.goto('/accounts');
  await expect(page.getByRole('heading', { name: 'Cloud NSave', exact: true })).toBeVisible();
  await write('Phone NSave');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'Phone NSave', exact: true })).toBeVisible();
});
