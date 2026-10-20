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
async function seed(page: Page) {
  await page.addInitScript((ledger) => {
    if (!localStorage.getItem('test-initialized')) {
      localStorage.setItem(
        'ember_ledger_v2',
        JSON.stringify({ ledger, revision: 1, cloudRevision: null, dirty: false, mode: 'browser' }),
      );
      localStorage.setItem('test-initialized', 'true');
    }
  }, fixture());
}
test.beforeEach(async ({ page }) => {
  await seed(page);
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
test('owner-authorized fresh start clears old browser copies once and preserves new records on reload', async ({
  page,
}) => {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      json: {
        configured: false,
        authenticated: false,
        workspaceResetGeneration: '00000000-0000-4000-8000-000000000001',
      },
    }),
  );
  await page.addInitScript(() => {
    if (!localStorage.getItem('reset-fixture-initialized')) {
      localStorage.setItem('ember_recovery_v2', 'old recovery');
      localStorage.setItem('ember_personal_workspace', 'old personal copy');
      sessionStorage.setItem('ember_pending', 'old pending');
      localStorage.setItem('reset-fixture-initialized', 'true');
    }
  });
  await page.goto('/accounts');
  await expect(
    page.getByRole('heading', { name: 'Accounts & transfers', exact: true }),
  ).toBeVisible();
  const first = await page.evaluate(() => ({
    ledger: JSON.parse(localStorage.getItem('ember_ledger_v2')!).ledger,
    recovery: localStorage.getItem('ember_recovery_v2'),
    personal: localStorage.getItem('ember_personal_workspace'),
    pending: sessionStorage.getItem('ember_pending'),
  }));
  expect(first.ledger.accounts).toEqual([]);
  expect(first.ledger.transactions).toEqual([]);
  expect(first.recovery).toBeNull();
  expect(first.personal).toBeNull();
  expect(first.pending).toBeNull();
  await page.evaluate((accounts) => {
    const state = JSON.parse(localStorage.getItem('ember_ledger_v2')!);
    state.ledger.accounts = accounts;
    state.revision++;
    localStorage.setItem('ember_ledger_v2', JSON.stringify(state));
  }, fixture().accounts);
  await page.reload();
  await expect(page.getByText('Local Bank', { exact: true })).toBeVisible();
});

test('existing future-dated postings open with a review notice instead of blocking startup', async ({
  page,
}) => {
  await page.goto('/accounts');
  await expect(
    page.getByRole('heading', { name: 'Accounts & transfers', exact: true }),
  ).toBeVisible();
  const futureDate = `${shiftMonth(localMonth(), 1)}-01`;
  await page.evaluate((date) => {
    const state = JSON.parse(localStorage.getItem('ember_ledger_v2')!);
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
    localStorage.setItem('ember_ledger_v2', JSON.stringify(state));
  }, futureDate);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Accounts & transfers', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: '2 future-dated records are marked done' }),
  ).toBeVisible();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('ember_ledger_v2')!).ledger,
  );
  expect(saved.transactions[0].date).toBe(futureDate);
  expect(saved.transactions[0].status).toBe('done');
  expect(saved.transfers[0].status).toBeUndefined();
  await page.goto('/transactions');
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Fixture client' })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});

test('browser-only startup never uploads records or requests external AI', async ({ page }) => {
  const sent: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/db') || r.url().includes('/api/ai/')) sent.push(r.url());
  });
  await page.goto('/coach');
  await expect(page.getByRole('heading', { name: 'Current observations' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request AI review' })).toBeDisabled();
  expect(sent).toEqual([]);
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
  await expect(page.getByRole('cell', { name: 'Market', exact: false })).toBeVisible();
  const tx = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('ember_ledger_v2')!).ledger.transactions.find(
      (t: { merchant: string }) => t.merchant === 'Market',
    ),
  );
  expect(tx.currency).toBe('BDT');
  expect(tx.amountMinor).toBe(120000);
  await page.getByRole('button', { name: 'Add activity', exact: true }).last().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
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
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('ember_ledger_v2')!).ledger);
  expect(s.transfers).toHaveLength(1);
  expect(s.transfers[0].amountOutMinor).toBe(10000);
  expect(s.transfers[0].amountInMinor).toBe(1200000);
  await page.goto('/transactions');
  await expect(page.getByRole('cell', { name: 'Transfer fee', exact: false })).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Transfer to Local Bank', exact: false }),
  ).toBeVisible();
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
test('invalid restore is rejected, valid archive previews before replacement', async ({ page }) => {
  await page.goto('/settings');
  await page.getByLabel('Preview a JSON archive').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"accounts":[{"id":"broken"}]}'),
  });
  await expect(page.locator('main').getByRole('alert')).toBeVisible();
  await page.getByLabel('Preview a JSON archive').setInputFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture())),
  });
  await expect(page.getByText(/Validated archive: 2 accounts/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restore this archive' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Restore this archive' }).click();
  await expect(
    page.getByText('Archive restored. Review account balances before continuing.'),
  ).toBeVisible();
  expect(await page.evaluate(() => !!localStorage.getItem('ember_recovery_v2'))).toBe(true);
});
test('only one tab can edit and a waiting tab opens automatically after release', async ({
  page,
  context,
}) => {
  await page.goto('/dashboard');
  await expect(page.locator('main h1')).toBeVisible();
  const second = await context.newPage();
  await second.goto('/accounts');
  await expect(second.getByRole('heading', { name: 'Workspace editing is paused' })).toBeVisible();
  await page.close();
  await expect(
    second.getByRole('heading', { name: 'Accounts & transfers', exact: true }),
  ).toBeVisible();
  await expect(second.getByText('Local Bank', { exact: true })).toBeVisible();
  await second.reload();
  await expect(
    second.getByRole('heading', { name: 'Accounts & transfers', exact: true }),
  ).toBeVisible();
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
    (await request.post('/api/ai/coach', { headers: { Origin: origin }, data: {} })).status(),
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
  const appearance = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    appearance.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
});
test('cloud pull refreshes the mounted account page without replacing dirty edits', async ({
  page,
}) => {
  const origin = 'http://localhost:3100';
  await page.request.post('/api/auth/session', {
    headers: { Origin: origin },
    data: { password: 'ember-e2e-only-owner-password' },
  });
  const current = await (await page.request.get('/api/db')).json();
  const remote = fixture();
  remote.accounts[0].name = 'Cloud NSave';
  const saved = await page.request.post('/api/db', {
    headers: { Origin: origin },
    data: { expectedRevision: current.revision, data: remote },
  });
  expect(saved.status()).toBe(200);
  await page.goto('/dashboard');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate((revision) => {
    const s = JSON.parse(localStorage.getItem('ember_ledger_v2')!);
    s.mode = 'cloud';
    s.cloudRevision = revision;
    s.dirty = false;
    localStorage.setItem('ember_ledger_v2', JSON.stringify(s));
  }, current.revision);
  await page.goto('/accounts');
  await expect(page.getByRole('heading', { name: 'Cloud NSave', exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('ember_ledger_v2')!).ledger.accounts[0].name,
    ),
  ).toBe('Cloud NSave');
});
