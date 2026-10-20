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
import { triggerAutoSync } from './sync';

export const LEDGER_EVENT = 'ember_ledger_changed';
export const LEDGER_KEY = 'ember_ledger_v2';
export interface LocalState {
  ledger: LedgerSnapshot;
  revision: number;
  cloudRevision: number | null;
  dirty: boolean;
  mode: 'browser' | 'cloud' | 'demo';
}
const initial = (): LocalState => ({
  ledger: emptyLedger(),
  revision: 0,
  cloudRevision: null,
  dirty: false,
  mode: 'browser',
});
let cachedRaw: string | null = null;
let cachedState: LocalState | null = null;
function read(): LocalState {
  if (typeof window === 'undefined') return initial();
  const raw = localStorage.getItem(LEDGER_KEY);
  if (raw && raw === cachedRaw && cachedState) return cachedState;
  if (raw) {
    const data = JSON.parse(raw) as LocalState;
    if (
      !Number.isSafeInteger(data.revision) ||
      data.revision < 0 ||
      typeof data.dirty !== 'boolean' ||
      (data.cloudRevision !== null &&
        (!Number.isSafeInteger(data.cloudRevision) || data.cloudRevision < 0)) ||
      !['browser', 'cloud', 'demo'].includes(data.mode)
    )
      throw new Error('Saved ledger metadata is invalid. Export a recovery copy before restoring.');
    cachedState = { ...data, ledger: validateLedger(data.ledger) };
    cachedRaw = raw;
    return cachedState;
  }
  const legacy: Record<string, unknown> = {};
  let exists = false;
  for (const key of [
    'accounts',
    'categories',
    'transactions',
    'transfers',
    'subscriptions',
    'budgets',
    'goals',
    'exchangeRates',
    'insights',
    'settings',
  ]) {
    const value = localStorage.getItem('ember_' + key);
    if (value !== null) {
      legacy[key] = JSON.parse(value);
      exists = true;
    }
  }
  const state = initial();
  if (exists) {
    state.ledger = normalizeLedger(legacy);
    state.dirty = true;
  }
  // Legacy keys remain untouched for recovery; initialization never uploads demo data.
  write(state, false);
  return state;
}
function write(state: LocalState, notify = true) {
  if (typeof window === 'undefined') throw new Error('Browser storage is unavailable');
  const raw = JSON.stringify(state);
  localStorage.setItem(LEDGER_KEY, raw); // Atomic write; failures must propagate.
  cachedRaw = raw;
  cachedState = state;
  if (notify) window.dispatchEvent(new CustomEvent(LEDGER_EVENT));
}
export function mutateLedger(change: (ledger: LedgerSnapshot) => void) {
  const before = read();
  const ledger = structuredClone(before.ledger);
  change(ledger);
  // Enforce entry rules at the write boundary without making existing history
  // unreadable or preventing unrelated corrections to an older ledger.
  for (const key of ['transactions', 'transfers'] as const) {
    for (const entry of ledger[key]) {
      if ((entry.status ?? 'done') !== 'done' || entry.date <= localDate()) continue;
      const previous = before.ledger[key].find((item) => item.id === entry.id);
      if (!previous || previous.date !== entry.date || previous.status !== entry.status)
        throw new Error(`Future ${key} must be planned or pending (${entry.date})`);
    }
  }
  write({ ...before, ledger: validateLedger(ledger), revision: before.revision + 1, dirty: true });
  if (before.mode === 'cloud') triggerAutoSync();
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
  initialize: () => read(),
  getSnapshot: (): LedgerSnapshot => read().ledger,
  getLocalState: (): LocalState => read(),
  setMode: (mode: LocalState['mode']) => {
    const current = read();
    if (current.mode === 'demo' && mode !== 'demo')
      throw new Error(
        'Return to your saved personal workspace before changing storage mode. Demo records cannot be synced.',
      );
    write({ ...current, mode });
  },
  acceptCloud: (ledger: unknown, revision: number) => {
    const state = read();
    if (state.mode === 'demo')
      throw new Error('Return to the personal workspace before loading server data');
    store.saveRecoveryCopy();
    write({
      ledger: normalizeLedger(ledger),
      revision: state.revision + 1,
      cloudRevision: revision,
      dirty: false,
      mode: 'cloud',
    });
  },
  acknowledgeCloud: (cloudRevision: number, sentRevision: number) => {
    const current = read();
    write({ ...current, cloudRevision, dirty: current.revision !== sentRevision });
  },
  setCloudRevisionForReplacement: (revision: number) => {
    if (read().mode === 'demo') throw new Error('Demo data cannot replace the server ledger');
    write({ ...read(), mode: 'cloud', cloudRevision: revision, dirty: true });
  },
  saveRecoveryCopy: () => {
    const raw = localStorage.getItem(LEDGER_KEY);
    if (raw) localStorage.setItem('ember_recovery_v2', raw);
  },
  getRecoveryRaw: () =>
    Object.fromEntries(
      Object.keys(localStorage)
        .filter((k) => k.startsWith('ember_'))
        .map((k) => [k, localStorage.getItem(k)]),
    ),
  getAccounts: () => read().ledger.accounts,
  createAccount: (a: Omit<Account, 'id'>) => create<Account>('accounts', a),
  updateAccount: (id: string, values: Partial<Account>) => {
    const old = store.getAccounts().find((a) => a.id === id);
    const s = read().ledger;
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
    const s = read().ledger;
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
  getCategories: () => read().ledger.categories,
  createCategory: (c: Omit<Category, 'id'> & { id?: string }) => create<Category>('categories', c),
  updateCategory: (id: string, values: Partial<Category>) =>
    update<Category>('categories', id, values),
  deleteCategory: (id: string) => remove('categories', id),
  getTransactions: () => read().ledger.transactions,
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
  getTransfers: () => read().ledger.transfers,
  createTransfer: (t: Omit<Transfer, 'id'> & { id?: string }) =>
    create<Transfer>('transfers', {
      ...t,
      reportingRate: t.reportingRate ?? store.getReferenceRate(),
    }),
  updateTransfer: (id: string, values: Partial<Transfer>) =>
    update<Transfer>('transfers', id, values),
  deleteTransfer: (id: string) => remove('transfers', id),
  getSubscriptions: () => read().ledger.subscriptions,
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
  getBudgets: () => read().ledger.budgets,
  setBudget: (b: Omit<Budget, 'id'>) => {
    const found = store
      .getBudgets()
      .find((x) => x.categoryId === b.categoryId && x.month === b.month);
    return found ? update<Budget>('budgets', found.id, b) : create<Budget>('budgets', b);
  },
  upsertBudget: (b: Omit<Budget, 'id'>) => store.setBudget(b),
  updateBudget: (id: string, values: Partial<Budget>) => update<Budget>('budgets', id, values),
  deleteBudget: (id: string) => remove('budgets', id),
  getGoals: () => read().ledger.goals,
  createGoal: (g: Omit<Goal, 'id'>) => {
    if (g.currentMinor > 0 && !g.accountId)
      throw new Error('Choose the account holding this goal money');
    if (g.accountId && availableOf(read().ledger, g.accountId) < g.currentMinor)
      throw new Error('Insufficient unreserved funds');
    return create<Goal>('goals', g);
  },
  updateGoal: (id: string, values: Partial<Goal>) => {
    const s = read().ledger;
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
  getAllocations: () => read().ledger.allocations,
  createAllocation: (a: Omit<Allocation, 'id'>) => {
    if (a.amountMinor > availableOf(read().ledger, a.accountId))
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
  getExchangeRates: () => read().ledger.exchangeRates,
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
  getInsights: () => read().ledger.insights,
  addInsight: (i: Omit<CoachInsight, 'id'>) => create<CoachInsight>('insights', i),
  clearInsights: () =>
    mutateLedger((s) => {
      s.insights = [];
    }),
  getSettings: () => read().ledger.settings,
  saveSettings: (settings: UserSettings) =>
    mutateLedger((s) => {
      s.settings = settings;
    }),
  isSeeded: () => typeof window !== 'undefined' && read().mode === 'demo',
  markSeeded: () => store.setMode('demo'),
  importAll: (data: unknown) => {
    const next = normalizeLedger(data);
    store.saveRecoveryCopy();
    mutateLedger((s) => Object.assign(s, next));
  },
  resetAll: () => {
    store.saveRecoveryCopy();
    const current = read();
    write({ ...current, ledger: emptyLedger(), dirty: true, revision: current.revision + 1 });
    if (current.mode === 'cloud') triggerAutoSync();
  },
};
