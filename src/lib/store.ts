import type {
  Account,
  Allocation,
  Budget,
  Category,
  CoachInsight,
  ExchangeRate,
  Goal,
  LedgerSnapshot,
  Subscription,
  Transaction,
  Transfer,
  UserSettings,
} from '@/types';
import { v4 as uuid } from 'uuid';
import { addBillingCycle, localDate } from './dates';
import {
  availableOf,
  balanceOf,
  emptyLedger,
  isSettled,
  normalizeLedger,
  validateLedger,
} from './ledger';
import { queueSave } from './sync';

export const LEDGER_EVENT = 'ember_ledger_changed';

// The database is the only copy. The page holds the ledger it loaded in memory,
// applies each change immediately, and the sync module saves it straight back.
let ledger: LedgerSnapshot = emptyLedger();
let revision = 0; // database revision this ledger is based on
let version = 0; // bumps on every change so views re-render
let connected = false; // only a ledger loaded from the database is ever saved
function set(next: LedgerSnapshot) {
  ledger = next;
  version++;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(LEDGER_EVENT));
}
export function mutateLedger(change: (ledger: LedgerSnapshot) => void) {
  const before = ledger;
  const next = structuredClone(before);
  change(next);
  // Enforce entry rules at the write boundary without making existing history
  // unreadable or preventing unrelated corrections to an older ledger.
  for (const key of ['transactions', 'transfers'] as const) {
    for (const entry of next[key]) {
      if ((entry.status ?? 'done') !== 'done' || entry.date <= localDate()) continue;
      const previous = before[key].find((item) => item.id === entry.id);
      if (!previous || previous.date !== entry.date || previous.status !== entry.status)
        throw new Error(`Future ${key} must be planned or pending (${entry.date})`);
    }
  }
  set(validateLedger(next));
  if (connected) queueSave();
}
type Collection =
  | 'accounts'
  | 'categories'
  | 'transactions'
  | 'transfers'
  | 'subscriptions'
  | 'budgets'
  | 'goals'
  | 'exchangeRates'
  | 'insights'
  | 'allocations';
function create<T extends { id: string }>(
  key: Collection,
  item: Omit<T, 'id'> & { id?: string },
): T {
  const created = { ...item, id: item.id || uuid() } as T;
  mutateLedger((s) => {
    (s[key] as unknown as T[]).push(created);
  });
  return created;
}
function update<T extends { id: string }>(
  key: Collection,
  id: string,
  values: Partial<T>,
): T | null {
  let result: T | null = null;
  mutateLedger((s) => {
    const items = s[key] as unknown as T[];
    const index = items.findIndex((i) => i.id === id);
    if (index < 0) throw new Error('This record no longer exists');
    result = { ...items[index], ...values, id };
    items[index] = result;
  });
  return result;
}
function remove(key: Collection, id: string): boolean {
  mutateLedger((s) => {
    const rows = s[key] as { id: string }[];
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) throw new Error('This record no longer exists');
    rows.splice(i, 1);
  });
  return true;
}
export const store = {
  getSnapshot: (): LedgerSnapshot => ledger,
  version: () => version,
  revision: () => revision,
  isConnected: () => connected,
  /** Replaces the in-memory ledger with the copy just read from (or saved to) the database. */
  replaceFromServer: (data: unknown, serverRevision: number) => {
    revision = serverRevision;
    connected = true;
    set(normalizeLedger(data));
  },
  /** Records a successful save without touching edits made while it was in flight. */
  markSaved: (serverRevision: number) => {
    revision = serverRevision;
  },
  /** Loads a ledger that is never saved anywhere (tests and previews). */
  hydrate: (data: LedgerSnapshot) => {
    revision = 0;
    connected = false;
    set(validateLedger(data));
  },
  getAccounts: () => ledger.accounts,
  createAccount: (a: Omit<Account, 'id'>) => create<Account>('accounts', a),
  updateAccount: (id: string, values: Partial<Account>) => {
    const old = store.getAccounts().find((a) => a.id === id);
    const s = ledger;
    if (
      old &&
      values.currency &&
      old.currency !== values.currency &&
      (s.transactions.some((t) => t.accountId === id) ||
        s.transfers.some((t) => t.fromAccountId === id || t.toAccountId === id) ||
        s.allocations.some((a) => a.accountId === id) ||
        s.goals.some((g) => g.accountId === id))
    )
      throw new Error('An account with activity keeps its currency. Create a new account instead.');
    return update<Account>('accounts', id, values);
  },
  deleteAccount: (id: string) => {
    const s = ledger;
    if (
      s.transactions.some((t) => t.accountId === id) ||
      s.transfers.some((t) => t.fromAccountId === id || t.toAccountId === id) ||
      s.subscriptions.some((t) => t.accountId === id) ||
      s.goals.some((g) => g.accountId === id) ||
      s.allocations.some((a) => a.accountId === id) ||
      s.reconciliations.some((r) => r.accountId === id)
    )
      throw new Error('This account has history or commitments. Archive it instead.');
    return remove('accounts', id);
  },
  getCategories: () => ledger.categories,
  createCategory: (c: Omit<Category, 'id'> & { id?: string }) => create<Category>('categories', c),
  /** Returns the id of a same-named category of this type, creating it if needed. */
  ensureCategory: (c: {
    name: string;
    type: 'income' | 'expense';
    id?: string;
    budgetGroup?: Category['budgetGroup'];
  }): string => {
    const name = c.name.trim();
    if (!name) throw new Error('Enter a category name');
    const existing = ledger.categories.find(
      (x) => x.type === c.type && x.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return existing.id;
    return store.createCategory({
      id: c.id && !ledger.categories.some((x) => x.id === c.id) ? c.id : undefined,
      name,
      type: c.type,
      parentId: null,
      color: c.type === 'income' ? '#6ee7a8' : '#ff8a5c',
      icon: c.type === 'income' ? 'briefcase' : 'wallet',
      ...(c.type === 'expense' ? { budgetGroup: c.budgetGroup ?? 'wants' } : {}),
    }).id;
  },
  updateCategory: (id: string, values: Partial<Category>) =>
    update<Category>('categories', id, values),
  deleteCategory: (id: string) => remove('categories', id),
  getTransactions: () => ledger.transactions,
  createTransaction: (t: Omit<Transaction, 'id'>) =>
    create<Transaction>('transactions', {
      ...t,
      reportingRate: t.reportingRate ?? store.getReferenceRate(),
    }),
  updateTransaction: (id: string, values: Partial<Transaction>) =>
    update<Transaction>('transactions', id, values),
  deleteTransaction: (id: string) => remove('transactions', id),
  bulkUpdateTransactions: (ids: string[], values: Partial<Transaction>) =>
    mutateLedger((s) => {
      s.transactions = s.transactions.map((t) =>
        ids.includes(t.id) ? { ...t, ...values, id: t.id } : t,
      );
    }),
  getTransfers: () => ledger.transfers,
  createTransfer: (t: Omit<Transfer, 'id'> & { id?: string }) =>
    create<Transfer>('transfers', {
      ...t,
      reportingRate: t.reportingRate ?? store.getReferenceRate(),
    }),
  updateTransfer: (id: string, values: Partial<Transfer>) =>
    update<Transfer>('transfers', id, values),
  deleteTransfer: (id: string) => remove('transfers', id),
  getSubscriptions: () => ledger.subscriptions,
  createSubscription: (s: Omit<Subscription, 'id'>) =>
    create<Subscription>('subscriptions', { ...s, anchorDay: Number(s.nextBillingDate.slice(8)) }),
  updateSubscription: (id: string, values: Partial<Subscription>) =>
    update<Subscription>('subscriptions', id, values),
  deleteSubscription: (id: string) => remove('subscriptions', id),
  recordSubscriptionPayment: (id: string, expectedPeriod: string, paymentDate = localDate()) =>
    mutateLedger((s) => {
      const sub = s.subscriptions.find((x) => x.id === id);
      if (!sub || !sub.active || !sub.accountId || !sub.categoryId)
        throw new Error('Choose an active bill with a funding account and expense category');
      if (
        sub.nextBillingDate !== expectedPeriod ||
        s.transactions.some((t) => t.subscriptionId === id && t.billingPeriod === expectedPeriod)
      )
        throw new Error(
          'This billing period is already recorded. Refresh to see the next payment.',
        );
      const anchorDay = sub.anchorDay ?? Number(sub.nextBillingDate.slice(8));
      s.transactions.push({
        id: uuid(),
        accountId: sub.accountId,
        categoryId: sub.categoryId,
        transferId: null,
        type: 'expense',
        amountMinor: sub.amountMinor,
        currency: sub.currency,
        merchant: sub.name,
        note: `Payment for ${expectedPeriod}`,
        date: paymentDate,
        tags: ['subscription'],
        paymentMethod: 'Manual confirmation',
        status: 'done',
        createdAt: new Date().toISOString(),
        subscriptionId: id,
        billingPeriod: expectedPeriod,
        reportingRate: store.getReferenceRate(),
      });
      sub.anchorDay = anchorDay;
      sub.nextBillingDate = addBillingCycle(expectedPeriod, sub.billingCycle, anchorDay);
    }),
  getBudgets: () => ledger.budgets,
  setBudget: (b: Omit<Budget, 'id'>) => {
    const found = store
      .getBudgets()
      .find((x) => x.categoryId === b.categoryId && x.month === b.month);
    return found ? update<Budget>('budgets', found.id, b) : create<Budget>('budgets', b);
  },
  upsertBudget: (b: Omit<Budget, 'id'>) => store.setBudget(b),
  updateBudget: (id: string, values: Partial<Budget>) => update<Budget>('budgets', id, values),
  deleteBudget: (id: string) => remove('budgets', id),
  getGoals: () => ledger.goals,
  createGoal: (g: Omit<Goal, 'id'>) => {
    if (g.currentMinor > 0 && !g.accountId)
      throw new Error('Choose the account holding this goal money');
    if (g.accountId && availableOf(ledger, g.accountId) < g.currentMinor)
      throw new Error('Insufficient unreserved funds');
    return create<Goal>('goals', g);
  },
  updateGoal: (id: string, values: Partial<Goal>) => {
    const s = ledger;
    const old = s.goals.find((g) => g.id === id);
    if (!old) throw new Error('Goal not found');
    const next = { ...old, ...values };
    if (next.accountId) {
      const free =
        availableOf(s, next.accountId) + (old.accountId === next.accountId ? old.currentMinor : 0);
      if (next.currentMinor > free) throw new Error('Insufficient unreserved money for this goal');
    } else if (next.currentMinor > old.currentMinor)
      throw new Error('Link a funding account before adding money');
    return update<Goal>('goals', id, values);
  },
  deleteGoal: (id: string) => remove('goals', id),
  getAllocations: () => ledger.allocations,
  createAllocation: (a: Omit<Allocation, 'id'>) => {
    if (a.amountMinor > availableOf(ledger, a.accountId))
      throw new Error('Insufficient unreserved money');
    if (a.incomeTransactionId) {
      const income = store.getTransactions().find((t) => t.id === a.incomeTransactionId);
      if (income && !isSettled(income)) throw new Error('Choose income settled on or before today');
      const allocated = store
        .getAllocations()
        .filter((x) => x.incomeTransactionId === a.incomeTransactionId)
        .reduce((n, x) => n + x.amountMinor, 0);
      if (!income || allocated + a.amountMinor > income.amountMinor)
        throw new Error('Reservations exceed this income payment');
    }
    return create<Allocation>('allocations', a);
  },
  deleteAllocation: (id: string) => remove('allocations', id),
  payAllocation: (
    id: string,
    amountMinor: number,
    date = localDate(),
    categoryId?: string,
    paymentId = uuid(),
  ) =>
    mutateLedger((s) => {
      if (s.transactions.some((t) => t.id === paymentId)) return;
      const a = s.allocations.find((a) => a.id === id);
      if (!a || amountMinor <= 0 || amountMinor > a.amountMinor)
        throw new Error('Payment must be positive and within the reserved amount');
      const account = s.accounts.find((x) => x.id === a.accountId)!;
      const cat = s.categories.find(
        (c) => c.id === (categoryId ?? 'giving') && c.type === 'expense',
      );
      if (!cat) throw new Error('Choose an expense category');
      s.transactions.push({
        id: paymentId,
        type: 'expense',
        accountId: a.accountId,
        categoryId: cat.id,
        transferId: null,
        currency: account.currency,
        amountMinor,
        merchant: a.name,
        note: `Payment from ${a.period} reserve`,
        date,
        tags: [a.kind],
        paymentMethod: 'Manual confirmation',
        status: 'done',
        createdAt: new Date().toISOString(),
        givingKind: a.kind === 'zakat' || a.kind === 'sadaqah' ? a.kind : undefined,
        allocationId: a.id,
        reportingRate: store.getReferenceRate(),
      });
      a.amountMinor -= amountMinor;
    }),
  reconcile: (accountId: string, statementBalanceMinor: number, date = localDate()) =>
    mutateLedger((s) => {
      const account = s.accounts.find((a) => a.id === accountId);
      if (!account) throw new Error('Account not found');
      const ledgerBalanceMinor = balanceOf(s, accountId);
      s.reconciliations.push({
        id: uuid(),
        accountId,
        date,
        statementBalanceMinor,
        ledgerBalanceMinor,
        differenceMinor: statementBalanceMinor - ledgerBalanceMinor,
        createdAt: new Date().toISOString(),
      });
      if (statementBalanceMinor === ledgerBalanceMinor) {
        account.reconciledAt = date;
        account.reconciledBalanceMinor = statementBalanceMinor;
      }
    }),
  getExchangeRates: () => ledger.exchangeRates,
  getReferenceRate: (): number =>
    store.getExchangeRates().find((r) => r.fromCurrency === 'USD' && r.toCurrency === 'BDT')
      ?.rate ?? 121.5,
  setExchangeRate: (r: Omit<ExchangeRate, 'id'>) => {
    const found = store
      .getExchangeRates()
      .find((x) => x.fromCurrency === r.fromCurrency && x.toCurrency === r.toCurrency);
    return found
      ? update<ExchangeRate>('exchangeRates', found.id, r)
      : create<ExchangeRate>('exchangeRates', r);
  },
  getInsights: () => ledger.insights,
  addInsight: (i: Omit<CoachInsight, 'id'>) => create<CoachInsight>('insights', i),
  clearInsights: () =>
    mutateLedger((s) => {
      s.insights = [];
    }),
  getSettings: () => ledger.settings,
  saveSettings: (settings: UserSettings) =>
    mutateLedger((s) => {
      s.settings = settings;
    }),
  importAll: (data: unknown) => {
    const next = normalizeLedger(data);
    mutateLedger((s) => Object.assign(s, next));
  },
  resetAll: () => mutateLedger((s) => Object.assign(s, emptyLedger())),
};
