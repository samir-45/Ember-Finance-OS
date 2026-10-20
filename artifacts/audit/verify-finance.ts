// Audit-only reproductions. Uses an in-memory store and blocks all network calls.
import fs from 'node:fs';
import { store } from '../../src/lib/store';
import { computeAccountBalance, computeDashboard, exportTransactionsCsv, computeSubscriptionMetrics } from '../../src/lib/finance';
import { runRulesEngine } from '../../src/lib/rules-engine';

process.env.TZ = 'Asia/Dhaka';
const memory = new Map<string, string>();
(globalThis as any).window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
(globalThis as any).localStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key),
};
(globalThis as any).fetch = async () => ({ json: async () => ({ success: true, provider: 'audit_mock' }) });
const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const date = `${month}-10`;
const account = (id: string, currency: 'USD' | 'BDT', openingBalanceMinor = 0) => ({ id, name: id, type: 'bank' as const, currency, openingBalanceMinor, color: '#fff', createdAt: date });
const tx = (id: string, type: 'income' | 'expense', amountMinor: number, currency: 'USD' | 'BDT', accountId: string) => ({ id, type, amountMinor, currency, accountId, categoryId: 'cat', transferId: null, merchant: id, note: '', date, tags: [], paymentMethod: 'manual', status: 'done' as const, createdAt: date });
function setup(extra: Record<string, any> = {}) {
  memory.clear();
  const data = { accounts: [account('usd', 'USD', 100000), account('bdt', 'BDT')], categories: [{ id: 'cat', name: 'Subscriptions', type: 'expense', parentId: null }], transactions: [], transfers: [], subscriptions: [], budgets: [], goals: [], exchangeRates: [{ id: 'rate', fromCurrency: 'USD', toCurrency: 'BDT', rate: 120, updatedAt: date }], ...extra };
  for (const [key, value] of Object.entries(data)) memory.set('ember_' + key, JSON.stringify(value));
}
const results: any[] = [];
setup({ transactions: [tx('bdt-on-usd', 'expense', 120000, 'BDT', 'usd')] });
results.push({ case: 'Currency mismatch: spend BDT 1,200 from USD account with USD 1,000', expectedUsdMinor: 99000, actualUsdMinor: computeAccountBalance('usd') });
setup({ transfers: [{ id: 'transfer', fromAccountId: 'usd', toAccountId: 'bdt', amountOutMinor: 10000, amountInMinor: 1200000, exchangeRate: 120, feeMinor: 500, feeCurrency: 'USD', date }] });
results.push({ case: 'USD 5 transfer fee reduces balance but is missing from expense totals', usdBalanceMinor: computeAccountBalance('usd'), expensesUsdMinor: computeDashboard().expensesThisMonth.usdMinor });
setup({ transfers: [{ id: 'cloud-transfer', fromAccountId: 'usd', toAccountId: 'bdt', fromAmountMinor: 10000, toAmountMinor: 1200000, exchangeRate: 120, feeMinor: 500, feeCurrency: 'USD', date }] });
results.push({ case: 'Database-shaped transfer is read by client balance calculator', expectedUsdMinor: 89500, actualUsdMinor: computeAccountBalance('usd'), expectedBdtMinor: 1200000, actualBdtMinor: computeAccountBalance('bdt') });
setup({ transactions: [tx('income', 'income', 100000, 'USD', 'usd')], subscriptions: [{ id: 'annual', name: 'Annual tool', amountMinor: 12000, currency: 'USD', billingCycle: 'yearly', active: true }] });
results.push({ case: 'Annual USD 120 subscription monthly load', normalizedUsdMinor: computeSubscriptionMetrics(store.getSubscriptions(), 100000).mreUsdMinor, ruleText: runRulesEngine().find(i => i.title.includes('Subscription'))?.body });
results.push({ case: 'Six-month chart in Asia/Dhaka', expectedLastMonth: month, actualChartMonths: computeDashboard().cashFlow.map(x => x.month) });
setup({ transactions: [{ ...tx('csv', 'expense', 100, 'USD', 'usd'), merchant: 'Client "Alpha"', note: '=1+1' }] });
results.push({ case: 'CSV escaping and formula protection', csv: exportTransactionsCsv() });
setup();
const realSetItem = (globalThis as any).localStorage.setItem;
(globalThis as any).localStorage.setItem = () => { throw new Error('Synthetic quota failure'); };
const originalError = console.error;
console.error = () => {};
const created = store.createTransaction(tx('lost-write', 'expense', 100, 'USD', 'usd'));
console.error = originalError;
(globalThis as any).localStorage.setItem = realSetItem;
results.push({ case: 'Failed storage write is reported to caller as successful creation', returnedId: created.id, persisted: store.getTransactions().some(t => t.id === created.id) });
const boundary = new Date('2026-11-01T00:30:00+06:00');
results.push({ case: 'Dhaka month boundary uses previous UTC date', localDate: boundary.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }), utcDateUsedByApp: boundary.toISOString().slice(0, 10) });
fs.writeFileSync('artifacts/audit/finance-results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
