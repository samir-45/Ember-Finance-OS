import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { emptyLedger } from '../../src/lib/ledger';

const origin = 'http://localhost:3100';
const password = 'ember-e2e-only-owner-password';
const ledger = emptyLedger();
ledger.accounts.push({
  id: 'auth-bank',
  name: 'Owner test bank',
  type: 'bank',
  currency: 'BDT',
  openingBalanceMinor: 2500000,
  color: '#ff9a72',
  createdAt: '2026-10-01',
});

async function vault(page: Page) {
  await page.route('**/api/db', (route) =>
    route.fulfill({
      json: { revision: 1, provider: 'file', data: ledger },
    }),
  );
}

async function signIn(page: Page) {
  const response = await page.request.post('/api/auth/session', {
    headers: { Origin: origin },
    data: { password },
  });
  expect(response.status()).toBe(200);
}

test('anonymous visitors see login on direct finance URLs and cannot read the vault', async ({
  page,
  request,
}) => {
  for (const route of ['/dashboard', '/accounts', '/settings', '/reports']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.locator('.desktop-sidebar')).toHaveCount(0);
  }
  expect((await request.get('/api/db')).status()).toBe(401);
  expect((await request.post('/api/db', { data: {} })).status()).toBe(401);
});

test('wrong password stays on login; correct login returns to requested page and connects the vault', async ({
  page,
}) => {
  await vault(page);
  await page.goto('/accounts');
  await page.getByLabel('Owner password', { exact: true }).fill('incorrect-owner-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#login-error')).toHaveText('Incorrect owner password');
  await expect(page.locator('.desktop-sidebar')).toHaveCount(0);
  await page.getByLabel('Owner password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/accounts');
  await expect(page.getByRole('heading', { name: 'Owner test bank', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ember_ledger_v2')!).mode)).toBe(
    'cloud',
  );
});

test('a new device loads the server ledger before opening finance pages', async ({ page }) => {
  let release!: () => void;
  let started!: () => void;
  const requested = new Promise<void>((resolve) => (started = resolve));
  const waiting = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/db', async (route) => {
    started();
    await waiting;
    await route.fulfill({ json: { revision: 3, provider: 'file', data: ledger } });
  });
  await signIn(page);
  await page.goto('/accounts');
  try {
    await requested;
    await expect(page.getByRole('heading', { name: 'Opening your workspace' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Owner test bank', exact: true })).toHaveCount(
      0,
    );
    await expect(page.locator('.desktop-sidebar')).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.getByRole('heading', { name: 'Owner test bank', exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ember_ledger_v2')!));
  expect(saved.cloudRevision).toBe(3);
  expect(saved.ledger.accounts[0].name).toBe('Owner test bank');
});

test('server outage on a new device shows retry instead of an empty workspace', async ({
  page,
}) => {
  await page.route('**/api/db', (route) =>
    route.fulfill({ status: 503, json: { error: 'Vault unavailable' } }),
  );
  await signIn(page);
  await page.goto('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Could not load your latest records' }),
  ).toBeVisible();
  await expect(page.getByText('Vault unavailable')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open saved browser copy' })).toHaveCount(0);
  await expect(page.locator('.desktop-sidebar')).toHaveCount(0);
});

test('startup preserves offline edits and marks a server conflict', async ({ page }) => {
  const local = structuredClone(ledger);
  local.accounts[0].name = 'Offline bank';
  await page.addInitScript((data) => {
    localStorage.setItem(
      'ember_ledger_v2',
      JSON.stringify({ ledger: data, revision: 2, cloudRevision: 1, dirty: true, mode: 'cloud' }),
    );
  }, local);
  await page.route('**/api/db', (route) =>
    route.fulfill({ json: { revision: 2, provider: 'file', data: ledger } }),
  );
  await signIn(page);
  await page.goto('/accounts');
  await expect(page.getByRole('heading', { name: 'Offline bank', exact: true })).toBeVisible();
  await expect(
    page.getByText('This browser has changes that differ from the server.'),
  ).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ember_ledger_v2')!));
  expect(saved.dirty).toBe(true);
  expect(saved.ledger.accounts[0].name).toBe('Offline bank');
});

test('sign-out closes the workspace and retains the local ledger for the owner to resume', async ({
  page,
}) => {
  await vault(page);
  await signIn(page);
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/login');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('ember_ledger_v2')!).ledger.accounts[0].name,
    ),
  ).toBe('Owner test bank');
  await page.goto('/accounts');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Owner test bank', exact: true })).toHaveCount(0);
  expect((await page.request.get('/api/db')).status()).toBe(401);
});

test('sign-out preserves unsynced edits after a single confirmation', async ({ page }) => {
  await vault(page);
  await signIn(page);
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('ember_ledger_v2')!);
    state.ledger.settings.givingPercent = 2.5;
    state.revision++;
    state.dirty = true;
    localStorage.setItem('ember_ledger_v2', JSON.stringify(state));
    window.dispatchEvent(new Event('ember_ledger_changed'));
  });
  let confirmations = 0;
  page.on('dialog', async (dialog) => {
    confirmations++;
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/login');
  expect(confirmations).toBe(1);
  const retained = await page.evaluate(() => JSON.parse(localStorage.getItem('ember_ledger_v2')!));
  expect(retained.dirty).toBe(true);
  expect(retained.ledger.settings.givingPercent).toBe(2.5);
});

test('a session removed while a finance page is open locks the workspace on focus', async ({
  page,
  context,
}) => {
  await vault(page);
  await signIn(page);
  await page.goto('/accounts');
  await expect(page.getByRole('heading', { name: 'Owner test bank', exact: true })).toBeVisible();
  await context.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('.desktop-sidebar')).toHaveCount(0);
});

test('session expiry closes an open workspace without a navigation or focus event', async ({
  page,
  context,
}) => {
  await vault(page);
  await signIn(page);
  const expiresAt = Date.now() + 3000;
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      json: {
        configured: true,
        authenticated: true,
        expiresAt,
        workspaceResetGeneration: null,
      },
    }),
  );
  await page.goto('/accounts');
  await expect(page.getByRole('heading', { name: 'Owner test bank', exact: true })).toBeVisible();
  await context.clearCookies();
  await expect(page).toHaveURL(/\/login/, { timeout: 6000 });
  await expect(page.locator('.desktop-sidebar')).toHaveCount(0);
});

test('unreachable session verification never reveals a cached financial workspace', async ({
  page,
}) => {
  await signIn(page);
  await page.addInitScript(
    (data) =>
      localStorage.setItem(
        'ember_ledger_v2',
        JSON.stringify({
          ledger: data,
          revision: 1,
          cloudRevision: 1,
          dirty: false,
          mode: 'cloud',
        }),
      ),
    ledger,
  );
  await page.route('**/api/auth/session', (route) => route.abort());
  await page.goto('/accounts');
  await expect(page.getByRole('heading', { name: 'Could not verify sign-in' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Owner test bank', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download recovery copy' })).toHaveCount(0);
});

test('login fits mobile and desktop with accessible controls and no page errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map((node) => node.target) })),
    ).toEqual([]);
    fs.mkdirSync('artifacts/verification/screenshots', { recursive: true });
    await page.screenshot({ path: `artifacts/verification/screenshots/login-${width}.png` });
  }
  await page.getByLabel('Owner password', { exact: true }).fill('test');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Owner password', { exact: true })).toHaveAttribute('type', 'text');
  expect(errors).toEqual([]);
});
