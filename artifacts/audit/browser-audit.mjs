// Audit-only browser session: temporary browser profile, synthetic financial data,
// all /api/* calls intercepted. Never reads or mutates the real server ledger.
import fs from 'node:fs';
import { puppeteer } from 'file:///C:/Users/samir/AppData/Local/npm-cache/_npx/15c61037b1978c83/node_modules/chrome-devtools-mcp/build/src/third_party/index.js';

const fixture = {
  accounts: [{ id: 'usd', name: 'Demo NSave', type: 'bank', currency: 'USD', openingBalanceMinor: 100000, color: '#ff6a2b', createdAt: '2026-10-01' }, { id: 'bdt', name: 'Demo Local Bank', type: 'bank', currency: 'BDT', openingBalanceMinor: 5000000, color: '#6ee7a8', createdAt: '2026-10-01' }],
  categories: [{ id: 'income', name: 'Client Payment', type: 'income', parentId: null, color: '#6ee7a8', icon: 'briefcase' }, { id: 'groceries', name: 'Groceries', type: 'expense', parentId: null, color: '#ff6a2b', icon: 'shopping-cart' }],
  transactions: [{ id: 'tx', accountId: 'usd', categoryId: 'income', type: 'income', amountMinor: 100000, currency: 'USD', merchant: 'Demo Client', note: 'Synthetic audit fixture', date: '2026-10-10', tags: [], paymentMethod: 'manual', status: 'done', createdAt: '2026-10-10' }],
  transfers: [], budgets: [{ id: 'budget', categoryId: 'groceries', month: '2026-10', limitMinor: 1500000, currency: 'BDT' }],
  subscriptions: [{ id: 'sub', name: 'Demo Tool', amountMinor: 2000, currency: 'USD', billingCycle: 'monthly', nextBillingDate: '2026-10-25', categoryId: 'groceries', accountId: 'usd', active: true, createdAt: '2026-10-01' }],
  goals: [{ id: 'goal', name: 'Demo Emergency Fund', targetMinor: 50000000, currentMinor: 10000000, currency: 'BDT', deadline: '2027-10-01', createdAt: '2026-10-01' }],
  exchangeRates: [{ id: 'rate', fromCurrency: 'USD', toCurrency: 'BDT', rate: 120, updatedAt: '2026-10-01' }],
  settings: { baseCurrency: 'BDT', displayCurrency: 'BDT', aiCoachEnabled: false, shareAiDetails: false, compactMode: false }, insights: [],
};
const browser = await puppeteer.launch({ executablePath: 'C:/Users/samir/AppData/Local/imput/Helium/Application/chrome.exe', headless: true, args: ['--no-first-run', '--disable-extensions', '--disable-background-networking'] });
const page = await browser.newPage();
await page.emulateTimezone('Asia/Dhaka');
const errors = [], requests = [], results = [];
page.on('pageerror', e => errors.push(e.message));
await page.setRequestInterception(true);
page.on('request', request => {
  const url = new URL(request.url());
  if (url.pathname.startsWith('/api/')) {
    requests.push({ path: url.pathname, method: request.method() });
    const body = url.pathname === '/api/db' ? request.method() === 'GET' ? { exists: true, provider: 'local_vault', data: fixture } : { success: true, provider: 'local_vault' } : { success: false, error: 'External AI disabled during audit' };
    request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  } else if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') request.abort();
  else request.continue();
});
await page.evaluateOnNewDocument(data => {
  localStorage.clear();
  for (const [key, value] of Object.entries(data)) localStorage.setItem('ember_' + key, JSON.stringify(value));
  localStorage.setItem('ember_seeded', 'true');
}, fixture);
try {
  for (const width of [1440, 768, 390]) {
    await page.setViewport({ width, height: 1000 });
    for (const route of ['dashboard', 'transactions', 'accounts', 'subscriptions', 'budgets', 'goals', 'reports', 'coach', 'settings']) {
      await page.goto('http://127.0.0.1:3100/' + route, { waitUntil: 'networkidle0', timeout: 45000 });
      await new Promise(r => setTimeout(r, 300));
      const layout = await page.evaluate(() => ({ title: document.querySelector('h1')?.innerText, viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, clipped: [...document.querySelectorAll('main *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right > innerWidth + 2; }).slice(0, 8).map(e => ({ tag: e.tagName, class: e.className?.baseVal ?? e.className, right: Math.round(e.getBoundingClientRect().right) })), text: document.querySelector('main')?.innerText.slice(0, 160) }));
      results.push({ route, width, ...layout });
      if (width !== 768 && ['dashboard', 'accounts', 'settings'].includes(route)) await page.screenshot({ path: `artifacts/audit/${route}-${width}.png`, fullPage: true });
      if (route === 'transactions' && width === 1440) {
        await page.evaluate(() => [...document.querySelectorAll('main button')].find(b => b.textContent.includes('Add Activity')).click());
        const modal = await page.evaluate(() => { const e = document.querySelector('.modal-overlay'); const r = e.getBoundingClientRect(); return { position: getComputedStyle(e).position, top: r.top, height: r.height, viewportHeight: innerHeight, role: e.getAttribute('role'), dialogs: document.querySelectorAll('[role=dialog],dialog').length }; });
        results.push({ case: 'Add Activity modal', ...modal });
        await page.screenshot({ path: 'artifacts/audit/transaction-form-1440.png', fullPage: true });
      }
    }
  }
  fixture.accounts[0].name = 'CLOUD PULLED ACCOUNT';
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:3100/accounts', { waitUntil: 'networkidle0', timeout: 45000 });
  results.push(await page.evaluate(() => ({ case: 'Cloud pull does not refresh mounted account page', cloudNameInStorage: JSON.parse(localStorage.getItem('ember_accounts'))[0].name, cloudNameVisible: document.querySelector('main').innerText.includes('CLOUD PULLED ACCOUNT') })));
  fs.writeFileSync('artifacts/audit/browser-results.json', JSON.stringify({ results, errors, requests }, null, 2));
  console.log(JSON.stringify({ pages: results.length, errors, layout: results.map(({ route, width, scrollWidth, clipped, ...rest }) => ({ route, width, scrollWidth, overflowCount: clipped?.length, ...(route ? {} : rest) })), aiRequestsDespiteDisabledSetting: requests.filter(r => r.path.startsWith('/api/ai/')).length }, null, 2));
} finally { await browser.close(); }
