import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { addBillingCycle, localDate, localMonth, shiftMonth } from '../src/lib/dates';
import {
  computeDashboard,
  computeIncomeBaseline,
  computeRunway,
  computeSubscriptionMetrics,
  csvCell,
  exportTransactionsCsv,
  getLedgerEntries,
  monthlyTotals,
  toMinor,
} from '../src/lib/finance';
import { availableOf, balanceOf, emptyLedger, normalizeLedger } from '../src/lib/ledger';
import { runRulesEngine } from '../src/lib/rules-engine';
import { LEDGER_KEY, store } from '../src/lib/store';
import type { LedgerSnapshot, Transaction } from '../src/types';

class MemoryStorage {
  data = new Map<string, string>();
  fail = false;
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.fail) throw new Error('Quota exceeded');
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
}
const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
function fixture(): LedgerSnapshot {
  const s = emptyLedger();
  s.accounts = [
    {
      id: 'usd',
      name: 'NSave',
      type: 'bank',
      currency: 'USD',
      openingBalanceMinor: 100000,
      color: '#fff',
      createdAt: localDate(),
    },
    {
      id: 'bdt',
      name: 'Bank',
      type: 'bank',
      currency: 'BDT',
      openingBalanceMinor: 10000000,
      color: '#fff',
      createdAt: localDate(),
    },
  ];
  s.exchangeRates = [
    { id: 'rate', fromCurrency: 'USD', toCurrency: 'BDT', rate: 120, updatedAt: localDate() },
  ];
  return s;
}
const expense = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'expense',
  accountId: 'bdt',
  categoryId: 'groceries',
  transferId: null,
  type: 'expense',
  amountMinor: 120000,
  currency: 'BDT',
  merchant: 'Market',
  note: '',
  date: localDate(),
  tags: [],
  paymentMethod: 'Manual',
  status: 'done',
  createdAt: localDate(),
  reportingRate: 120,
  ...overrides,
});
function load(s = fixture()) {
  storage.setItem(
    LEDGER_KEY,
    JSON.stringify({
      ledger: s,
      revision: Math.floor(Math.random() * 100000) + 1,
      cloudRevision: null,
      mode: 'browser',
      dirty: false,
    }),
  );
}
beforeEach(() => {
  storage.fail = false;
  storage.clear();
  load();
});

test('currency mismatches, orphan references, invalid dates, and unsafe money are rejected before saving', () => {
  for (const values of [
    { currency: 'USD' as const },
    { accountId: 'missing' },
    { date: '2026-02-30' },
    { amountMinor: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    const before = storage.getItem(LEDGER_KEY);
    assert.throws(() => store.createTransaction(expense(values)));
    assert.equal(storage.getItem(LEDGER_KEY), before);
  }
});
test('future settled entries are rejected, pending entries do not alter balances', () => {
  const date = `${shiftMonth(localMonth(), 1)}-01`;
  assert.throws(() => store.createTransaction(expense({ date })));
  store.createTransaction(expense({ date, status: 'pending' }));
  assert.equal(balanceOf(store.getSnapshot(), 'bdt'), 10000000);
});

test('existing future-dated postings remain readable, unchanged, and excluded from current funds', () => {
  const s = fixture();
  const date = `${shiftMonth(localMonth(), 1)}-01`;
  s.transactions = [expense({ date })];
  s.transfers = [
    {
      id: 'future-transfer',
      fromAccountId: 'usd',
      toAccountId: 'bdt',
      amountOutMinor: 10000,
      amountInMinor: 1200000,
      exchangeRate: 120,
      feeMinor: 500,
      feeCurrency: 'USD',
      date,
      createdAt: date,
    },
  ];
  for (const legacy of [false, true]) {
    storage.clear();
    if (legacy) {
      for (const [key, value] of Object.entries(s)) {
        if (key !== 'version') storage.setItem(`ember_${key}`, JSON.stringify(value));
      }
    } else load(s);
    const original = storage.getItem(legacy ? 'ember_transactions' : LEDGER_KEY);
    store.initialize();
    assert.deepEqual(store.getTransactions(), s.transactions);
    assert.deepEqual(store.getTransfers(), legacy ? normalizeLedger(s).transfers : s.transfers);
    assert.equal(storage.getItem(legacy ? 'ember_transactions' : LEDGER_KEY), original);
    assert.equal(balanceOf(store.getSnapshot(), 'bdt'), 10000000);
    assert.equal(balanceOf(store.getSnapshot(), 'usd'), 100000);
    assert.equal(monthlyTotals(date.slice(0, 7)).expenses.bdtMinor, 0);
    store.updateAccount('bdt', { name: 'Corrected bank name' });
    assert.equal(store.getTransactions()[0].status, 'done');
    assert.throws(
      () => store.createTransaction(expense({ id: 'new-future', date })),
      /planned or pending/,
    );
    store.updateTransaction('expense', { status: 'pending' });
    assert.equal(store.getTransactions()[0].status, 'pending');
  }
});
test('USD to BDT transfer debits principal plus USD fee and counts the fee once', () => {
  store.createTransfer({
    id: 'tr',
    fromAccountId: 'usd',
    toAccountId: 'bdt',
    amountOutMinor: 10000,
    amountInMinor: 1200000,
    exchangeRate: 120,
    feeMinor: 500,
    feeCurrency: 'USD',
    date: localDate(),
    createdAt: localDate(),
  });
  const s = store.getSnapshot();
  assert.equal(balanceOf(s, 'usd'), 89500);
  assert.equal(balanceOf(s, 'bdt'), 11200000);
  assert.equal(monthlyTotals(localMonth()).expenses.usdMinor, 500);
  assert.equal(getLedgerEntries().length, 3);
  store.deleteTransfer('tr');
  assert.equal(balanceOf(store.getSnapshot(), 'usd'), 100000);
  assert.equal(monthlyTotals(localMonth()).expenses.usdMinor, 0);
});
test('destination-currency fees debit the destination rather than interpreting BDT as USD', () => {
  store.createTransfer({
    fromAccountId: 'usd',
    toAccountId: 'bdt',
    amountOutMinor: 10000,
    amountInMinor: 1200000,
    exchangeRate: 120,
    feeMinor: 12000,
    feeCurrency: 'BDT',
    date: localDate(),
    createdAt: localDate(),
  });
  assert.equal(balanceOf(store.getSnapshot(), 'usd'), 90000);
  assert.equal(balanceOf(store.getSnapshot(), 'bdt'), 11188000);
  assert.equal(monthlyTotals(localMonth()).expenses.usdMinor, 100);
});
test('reverse and same-currency transfers preserve account currency and reject self-transfers', () => {
  store.createTransfer({
    fromAccountId: 'bdt',
    toAccountId: 'usd',
    amountOutMinor: 1200000,
    amountInMinor: 10000,
    exchangeRate: 120,
    feeMinor: 100,
    feeCurrency: 'USD',
    date: localDate(),
    createdAt: localDate(),
  });
  assert.equal(balanceOf(store.getSnapshot(), 'usd'), 109900);
  assert.equal(balanceOf(store.getSnapshot(), 'bdt'), 8800000);
  assert.throws(() =>
    store.createTransfer({
      fromAccountId: 'usd',
      toAccountId: 'usd',
      amountOutMinor: 100,
      amountInMinor: 100,
      exchangeRate: 1,
      feeMinor: 0,
      feeCurrency: 'USD',
      date: localDate(),
      createdAt: localDate(),
    }),
  );
});
test('Dhaka calendar boundaries and six-month chart include the current month', () => {
  assert.equal(localDate(new Date('2026-10-31T18:30:00Z')), '2026-11-01');
  assert.equal(localMonth(new Date('2026-10-31T18:30:00Z')), '2026-11');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  const chart = computeDashboard().cashFlow;
  assert.equal(chart.length, 6);
  assert.equal(chart.at(-1)?.month, localMonth());
  assert.equal(chart[0].month, shiftMonth(localMonth(), -5));
});
test('all engines normalize annual and weekly recurring costs consistently', () => {
  store.createTransaction(
    expense({
      id: 'income',
      accountId: 'usd',
      categoryId: 'client-payment',
      type: 'income',
      currency: 'USD',
      amountMinor: 100000,
    }),
  );
  store.createSubscription({
    name: 'Annual tool',
    amountMinor: 12000,
    currency: 'USD',
    billingCycle: 'yearly',
    nextBillingDate: localDate(),
    categoryId: 'work-tools',
    accountId: 'usd',
    active: true,
    createdAt: localDate(),
  });
  assert.equal(computeSubscriptionMetrics(store.getSubscriptions(), 100000).mreUsdMinor, 1000);
  assert.match(runRulesEngine().find((i) => i.id === 'subscriptions')!.body, /\$10\/month/);
  assert.equal(
    computeSubscriptionMetrics(
      [{ amountMinor: 1200, currency: 'USD', billingCycle: 'weekly', active: true }],
      100000,
    ).mreUsdMinor,
    5200,
  );
});
test('renewals preserve the month-end anchor and reject duplicate billing periods atomically', () => {
  assert.equal(addBillingCycle('2026-01-31', 'monthly', 31), '2026-02-28');
  assert.equal(addBillingCycle('2026-02-28', 'monthly', 31), '2026-03-31');
  assert.equal(addBillingCycle('2026-12-29', 'weekly'), '2027-01-05');
  const sub = store.createSubscription({
    name: 'Tool',
    amountMinor: 1000,
    currency: 'USD',
    billingCycle: 'monthly',
    nextBillingDate: '2026-01-31',
    accountId: 'usd',
    categoryId: 'work-tools',
    active: true,
    createdAt: localDate(),
  });
  store.recordSubscriptionPayment(sub.id, '2026-01-31');
  assert.equal(store.getSubscriptions()[0].nextBillingDate, '2026-02-28');
  assert.throws(() => store.recordSubscriptionPayment(sub.id, '2026-01-31'));
  assert.equal(store.getTransactions().length, 1);
});
test('funded goals and allocations reserve real money without changing net worth', () => {
  const before = computeDashboard().netWorth.bdtMinor;
  store.createGoal({
    name: 'Emergency',
    currency: 'BDT',
    accountId: 'bdt',
    targetMinor: 5000000,
    currentMinor: 2000000,
    deadline: null,
    createdAt: localDate(),
  });
  assert.equal(availableOf(store.getSnapshot(), 'bdt'), 8000000);
  assert.equal(computeDashboard().netWorth.bdtMinor, before);
  assert.throws(() =>
    store.createAllocation({
      name: 'Too large',
      accountId: 'bdt',
      kind: 'sadaqah',
      amountMinor: 9000000,
      period: localMonth(),
      createdAt: localDate(),
    }),
  );
  const a = store.createAllocation({
    name: 'Giving',
    accountId: 'bdt',
    kind: 'sadaqah',
    amountMinor: 1000000,
    period: localMonth(),
    createdAt: localDate(),
  });
  const available = availableOf(store.getSnapshot(), 'bdt');
  store.payAllocation(a.id, 500000);
  assert.equal(availableOf(store.getSnapshot(), 'bdt'), available);
  assert.equal(store.getAllocations()[0].amountMinor, 500000);
  assert.equal(store.getTransactions()[0].givingKind, 'sadaqah');
});
test('budgets isolate months and include descendants', () => {
  store.createCategory({
    id: 'vegetables',
    name: 'Vegetables',
    parentId: 'groceries',
    type: 'expense',
    color: '#fff',
    icon: 'leaf',
  });
  store.createTransaction(expense({ categoryId: 'vegetables' }));
  store.setBudget({
    categoryId: 'groceries',
    month: localMonth(),
    limitMinor: 200000,
    currency: 'BDT',
  });
  store.setBudget({
    categoryId: 'groceries',
    month: shiftMonth(localMonth(), -1),
    limitMinor: 300000,
    currency: 'BDT',
  });
  const budgets = computeDashboard().budgets;
  assert.equal(budgets.length, 1);
  assert.equal(budgets[0].spentMinor, 120000);
});
test('historical translation stays stable when today reference rate changes', () => {
  store.createTransaction(expense());
  const before = monthlyTotals(localMonth()).expenses.usdMinor;
  store.setExchangeRate({
    fromCurrency: 'USD',
    toCurrency: 'BDT',
    rate: 150,
    updatedAt: localDate(),
  });
  assert.equal(monthlyTotals(localMonth()).expenses.usdMinor, before);
});
test('no expense history produces no runway or reassuring score', () => {
  const d = computeDashboard();
  assert.equal(d.hasExpenseHistory, false);
  assert.equal(d.runwayMonths, 0);
  assert.equal(d.healthScore, 0);
});
test('income baseline uses complete months and ignores the size of a partial current month', () => {
  store.createTransaction(
    expense({
      id: 'old-income',
      type: 'income',
      accountId: 'usd',
      categoryId: 'client-payment',
      currency: 'USD',
      amountMinor: 100000,
      date: `${shiftMonth(localMonth(), -1)}-01`,
    }),
  );
  store.createTransaction(
    expense({
      id: 'current-income',
      type: 'income',
      accountId: 'usd',
      categoryId: 'client-payment',
      currency: 'USD',
      amountMinor: 900000,
    }),
  );
  assert.equal(computeIncomeBaseline(), 100000);
});
test('purchase goals are excluded from runway while explicitly designated emergency reserves remain liquid', () => {
  store.createTransaction(
    expense({ date: `${shiftMonth(localMonth(), -1)}-01`, amountMinor: 1200000 }),
  );
  const before = computeRunway().months;
  const g = store.createGoal({
    name: 'Hardware',
    accountId: 'bdt',
    targetMinor: 2400000,
    currentMinor: 2400000,
    currency: 'BDT',
    deadline: null,
    createdAt: localDate(),
  });
  assert.ok(computeRunway().months < before);
  store.updateGoal(g.id, { isEmergency: true });
  assert.equal(computeRunway().months, before);
});
test('failed storage writes propagate and preserve the previous complete snapshot', () => {
  const before = storage.getItem(LEDGER_KEY);
  storage.fail = true;
  assert.throws(() => store.createTransaction(expense()), /Quota/);
  assert.equal(storage.getItem(LEDGER_KEY), before);
  assert.equal(store.getTransactions().length, 0);
});
test('backup restore preserves transfers, preferences, month fields and deletions', () => {
  store.createTransaction(expense());
  const original = JSON.parse(JSON.stringify(store.getSnapshot()));
  store.resetAll();
  store.importAll(original);
  assert.deepEqual(store.getSnapshot(), normalizeLedger(original));
  store.deleteTransaction('expense');
  assert.equal(store.getSnapshot().transactions.length, 0);
  const before = storage.getItem(LEDGER_KEY);
  assert.throws(() =>
    store.importAll({ ...original, transactions: [expense({ accountId: 'missing' })] }),
  );
  assert.equal(storage.getItem(LEDGER_KEY), before);
});
test('complete restore round trip retains funded goals, allocations, reconciliation, bills, and FX', () => {
  store.createTransfer({
    fromAccountId: 'usd',
    toAccountId: 'bdt',
    amountOutMinor: 10000,
    amountInMinor: 1200000,
    exchangeRate: 120,
    feeMinor: 100,
    feeCurrency: 'USD',
    date: localDate(),
    createdAt: localDate(),
  });
  store.setBudget({
    categoryId: 'groceries',
    month: localMonth(),
    limitMinor: 100000,
    currency: 'BDT',
  });
  store.createSubscription({
    name: 'Annual tool',
    amountMinor: 12000,
    currency: 'USD',
    billingCycle: 'yearly',
    nextBillingDate: localDate(),
    categoryId: 'work-tools',
    accountId: 'usd',
    active: true,
    createdAt: localDate(),
  });
  store.createGoal({
    name: 'Reserve',
    accountId: 'bdt',
    currency: 'BDT',
    targetMinor: 1000000,
    currentMinor: 500000,
    deadline: null,
    isEmergency: true,
    createdAt: localDate(),
  });
  store.createAllocation({
    name: 'Sadaqah',
    kind: 'sadaqah',
    accountId: 'bdt',
    amountMinor: 100000,
    period: localMonth(),
    createdAt: localDate(),
  });
  store.reconcile('bdt', balanceOf(store.getSnapshot(), 'bdt'));
  store.saveSettings({ ...store.getSettings(), givingPercent: 7, baseCurrency: 'USD' });
  const archive = JSON.parse(JSON.stringify(store.getSnapshot()));
  const balance = computeDashboard().netWorth;
  store.resetAll();
  store.importAll(archive);
  assert.deepEqual(store.getSnapshot(), normalizeLedger(archive));
  assert.deepEqual(computeDashboard().netWorth, balance);
});
test('legacy transfer aliases migrate and ambiguous budget periods remain unassigned', () => {
  const s = fixture();
  const legacy = {
    ...s,
    version: '1.0',
    transfers: [
      {
        id: 'legacy',
        fromAccountId: 'usd',
        toAccountId: 'bdt',
        fromAmountMinor: 10000,
        toAmountMinor: 1200000,
        exchangeRate: '120',
        feeMinor: 0,
        feeCurrency: 'USD',
        date: localDate(),
      },
    ],
    budgets: [
      {
        id: 'budget',
        categoryId: 'groceries',
        period: 'monthly',
        limitMinor: 100000,
        currency: 'BDT',
      },
    ],
  };
  const migrated = normalizeLedger(legacy);
  assert.equal(migrated.transfers[0].amountInMinor, 1200000);
  assert.equal(migrated.budgets[0].month, 'unassigned');
  assert.equal(balanceOf(migrated, 'usd'), 90000);
});
test('CSV escapes quotes, neutralizes formula text, and includes transfer records', () => {
  assert.equal(csvCell('Client "Alpha"'), '"Client ""Alpha"""');
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  store.createTransaction(expense({ merchant: 'Client "Alpha"', note: '=1+1' }));
  assert.match(exportTransactionsCsv(), /Client ""Alpha""/);
  assert.match(exportTransactionsCsv(), /'=1\+1/);
});
test('decimal money parsing preserves cents and rejects excess precision and overflow', () => {
  assert.equal(toMinor('1.01'), 101);
  assert.equal(toMinor('-.50'), -50);
  assert.equal(toMinor('90000000000000.01'), 9000000000000001);
  assert.throws(() => toMinor('1.001'));
  assert.throws(() => toMinor('1e12'));
  assert.throws(() => toMinor('90071992547410.00'));
});
test('repeated giving payment requests with the same operation ID are idempotent', () => {
  const a = store.createAllocation({
    name: 'Giving',
    accountId: 'bdt',
    kind: 'sadaqah',
    amountMinor: 100000,
    period: localMonth(),
    createdAt: localDate(),
  });
  store.payAllocation(a.id, 10000, localDate(), 'giving', 'payment-1');
  store.payAllocation(a.id, 10000, localDate(), 'giving', 'payment-1');
  assert.equal(store.getAllocations()[0].amountMinor, 90000);
  assert.equal(store.getTransactions().length, 1);
});
test('demo workspaces cannot switch directly into browser or cloud storage modes', () => {
  store.setMode('demo');
  assert.throws(() => store.setMode('cloud'));
  assert.throws(() => store.setMode('browser'));
});
test('accounts with history cannot be removed or have currency reinterpreted', () => {
  store.createTransaction(expense());
  assert.throws(() => store.deleteAccount('bdt'));
  assert.throws(() => store.updateAccount('bdt', { currency: 'USD' }));
  store.updateAccount('bdt', { archived: true });
  assert.equal(store.getAccounts().find((a) => a.id === 'bdt')!.archived, true);
});
test('reconciliation records differences without manufacturing a balance adjustment', () => {
  store.reconcile('bdt', 9000000);
  assert.equal(store.getSnapshot().reconciliations[0].differenceMinor, -1000000);
  assert.equal(balanceOf(store.getSnapshot(), 'bdt'), 10000000);
  assert.equal(store.getAccounts()[1].reconciledAt, undefined);
  store.reconcile('bdt', 10000000);
  assert.equal(store.getAccounts()[1].reconciledAt, localDate());
});
