import type { LedgerSnapshot } from '@/types';
import { z } from 'zod';
import { localDate } from './dates';

const id = z.string().min(1).max(160);
const text = z.string().max(4000);
const currency = z.enum(['USD', 'BDT']);
const minor = z.number().int().safe();
const positive = minor.positive();
const nonnegative = minor.nonnegative();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Enter a valid calendar date');
const month = z.string().regex(/^(\d{4}-(0[1-9]|1[0-2])|unassigned)$/);
const status = z.enum(['planned', 'pending', 'done']);
const timestamp = z.string().min(1).max(100);
const categorySchema = z.object({
  id,
  name: text.min(1),
  parentId: id.nullable(),
  type: z.enum(['income', 'expense']),
  color: text,
  icon: text,
  budgetGroup: z.enum(['needs', 'wants', 'savings', 'giving']).optional(),
});
export const settingsSchema = z.object({
  baseCurrency: currency.default('BDT'),
  displayCurrency: z.enum(['USD', 'BDT', 'original']).default('BDT'),
  aiCoachEnabled: z.boolean().default(false),
  shareAiDetails: z.boolean().default(false),
  compactMode: z.boolean().default(false),
  givingPercent: z.number().min(0).max(100).default(0),
  savingsTargetPercent: z.number().min(0).max(100).default(20),
  subscriptionLimitPercent: z.number().min(0).max(100).default(5),
});
export const ledgerSchema = z
  .object({
    version: z.literal(2),
    accounts: z.array(
      z.object({
        id,
        name: text.min(1),
        type: z.enum(['bank', 'wallet', 'cash', 'card', 'payoneer', 'paypal', 'receivable']),
        currency,
        openingBalanceMinor: minor,
        color: text,
        createdAt: timestamp,
        archived: z.boolean().optional(),
        reconciledAt: date.optional(),
        reconciledBalanceMinor: minor.optional(),
      }),
    ),
    categories: z.array(categorySchema),
    transactions: z.array(
      z.object({
        id,
        accountId: id,
        categoryId: id.nullable(),
        transferId: id.nullable(),
        type: z.enum(['income', 'expense']),
        amountMinor: positive,
        currency,
        note: text,
        merchant: text,
        date,
        tags: z.array(z.string().max(100)).max(100),
        paymentMethod: text,
        status,
        createdAt: timestamp,
        reportingRate: z.number().positive().finite().optional(),
        subscriptionId: id.optional(),
        billingPeriod: date.optional(),
        givingKind: z.enum(['zakat', 'sadaqah']).optional(),
        allocationId: id.optional(),
      }),
    ),
    transfers: z.array(
      z.object({
        id,
        fromAccountId: id,
        toAccountId: id,
        amountOutMinor: positive,
        amountInMinor: positive,
        exchangeRate: z.number().positive().finite(),
        feeMinor: nonnegative,
        feeCurrency: currency,
        date,
        createdAt: timestamp,
        status: status.optional(),
        note: text.optional(),
        reportingRate: z.number().positive().finite().optional(),
      }),
    ),
    subscriptions: z.array(
      z.object({
        id,
        name: text.min(1),
        amountMinor: positive,
        currency,
        billingCycle: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
        nextBillingDate: date,
        categoryId: id.nullable(),
        accountId: id.nullable(),
        active: z.boolean(),
        createdAt: timestamp,
        anchorDay: z.number().int().min(1).max(31).optional(),
      }),
    ),
    budgets: z.array(z.object({ id, categoryId: id, month, limitMinor: positive, currency })),
    goals: z.array(
      z.object({
        id,
        name: text.min(1),
        targetMinor: positive,
        currentMinor: nonnegative,
        currency,
        deadline: date.nullable(),
        createdAt: timestamp,
        accountId: id.nullable().optional(),
        isEmergency: z.boolean().optional(),
      }),
    ),
    exchangeRates: z.array(
      z.object({
        id,
        fromCurrency: currency,
        toCurrency: currency,
        rate: z.number().positive().finite(),
        updatedAt: timestamp,
      }),
    ),
    insights: z.array(
      z.object({
        id,
        kind: z.enum(['tip', 'warning', 'win', 'review']),
        severity: z.enum(['info', 'warning', 'critical']),
        title: text,
        body: text,
        action: text.optional(),
        period: z.string(),
        createdAt: timestamp,
      }),
    ),
    allocations: z.array(
      z.object({
        id,
        accountId: id,
        name: text.min(1),
        kind: z.enum(['zakat', 'sadaqah', 'bills', 'living', 'savings']),
        amountMinor: nonnegative,
        period: month,
        incomeTransactionId: id.optional(),
        createdAt: timestamp,
      }),
    ),
    reconciliations: z.array(
      z.object({
        id,
        accountId: id,
        date,
        statementBalanceMinor: minor,
        ledgerBalanceMinor: minor,
        differenceMinor: minor,
        createdAt: timestamp,
      }),
    ),
    settings: settingsSchema,
  })
  .superRefine((s, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    for (const [key, rows] of Object.entries(s))
      if (Array.isArray(rows)) {
        const ids = rows.map((r: { id: string }) => r.id);
        if (new Set(ids).size !== ids.length) issue(`Duplicate IDs in ${key}`);
      }
    const account = (key: string) => {
      const a = s.accounts.find((a) => a.id === key);
      if (!a) issue(`Missing account: ${key}`);
      return a;
    };
    for (const t of s.transactions) {
      const a = account(t.accountId);
      if (a && a.currency !== t.currency)
        issue(
          `Transaction ${t.id}: currency must match ${a.name} (${a.currency}). Correct the account or amount before importing.`,
        );
      if (t.categoryId) {
        const c = s.categories.find((c) => c.id === t.categoryId);
        if (!c || c.type !== t.type)
          issue(`Transaction ${t.id}: choose a matching ${t.type} category`);
      }
    }
    for (const t of s.transfers) {
      const from = account(t.fromAccountId),
        to = account(t.toAccountId);
      if (t.fromAccountId === t.toAccountId) issue('Choose two different transfer accounts');
      if (from && to && t.feeCurrency !== from.currency && t.feeCurrency !== to.currency)
        issue('Transfer fee currency must match a transfer account');
      if (from && to && from.currency === to.currency && t.amountOutMinor !== t.amountInMinor)
        issue('Same-currency principal amounts must match. Record fees separately.');
      if (from && to && from.currency !== to.currency) {
        const actual =
          from.currency === 'USD'
            ? t.amountInMinor / t.amountOutMinor
            : t.amountOutMinor / t.amountInMinor;
        if (Math.abs(actual - t.exchangeRate) > Math.max(0.000001, actual * 0.001))
          issue('Transfer rate must agree with the actual principal amounts');
      }
    }
    for (const c of s.categories) {
      if (c.parentId && !s.categories.some((p) => p.id === c.parentId && p.type === c.type))
        issue(`Invalid parent category for ${c.name}`);
      const visited = new Set([c.id]);
      let parent = c.parentId;
      while (parent) {
        if (visited.has(parent)) {
          issue('Category hierarchy contains a cycle');
          break;
        }
        visited.add(parent);
        parent = s.categories.find((p) => p.id === parent)?.parentId ?? null;
      }
    }
    for (const b of s.budgets)
      if (!s.categories.some((c) => c.id === b.categoryId && c.type === 'expense'))
        issue('Budget requires an expense category');
    const budgetKeys = s.budgets.map((b) => `${b.month}:${b.categoryId}`);
    if (new Set(budgetKeys).size !== budgetKeys.length)
      issue('Only one budget per category and month is allowed');
    const payments = s.transactions
      .filter((t) => t.subscriptionId && t.billingPeriod)
      .map((t) => `${t.subscriptionId}:${t.billingPeriod}`);
    if (new Set(payments).size !== payments.length)
      issue('This billing period already has a payment');
    for (const sub of s.subscriptions) {
      if (sub.accountId) {
        const a = account(sub.accountId);
        if (a && a.currency !== sub.currency)
          issue(`Subscription ${sub.name}: funding account currency must match`);
      }
      if (
        sub.categoryId &&
        !s.categories.some((c) => c.id === sub.categoryId && c.type === 'expense')
      )
        issue(`Subscription ${sub.name}: select an expense category`);
    }
    for (const g of s.goals)
      if (g.accountId) {
        const a = account(g.accountId);
        if (a && a.currency !== g.currency)
          issue(`Goal ${g.name}: funding account currency must match`);
      }
    for (const a of s.allocations) {
      account(a.accountId);
      if (
        a.incomeTransactionId &&
        !s.transactions.some(
          (t) =>
            t.id === a.incomeTransactionId &&
            t.type === 'income' &&
            t.accountId === a.accountId &&
            t.status === 'done',
        )
      )
        issue('Allocation requires settled income in its funding account');
    }
    for (const r of s.reconciliations) account(r.accountId);
    for (const a of s.accounts) {
      if (!Number.isSafeInteger(balanceOf(s as LedgerSnapshot, a.id)))
        issue(`Balance exceeds the supported minor-unit range for ${a.name}`);
      if (!Number.isSafeInteger(reservedOf(s as LedgerSnapshot, a.id)))
        issue(`Reservations exceed the supported minor-unit range for ${a.name}`);
    }
  });

// Validated so its field order matches stored ledgers; startup compares them as JSON text.
export function emptyLedger(): LedgerSnapshot {
  return validateLedger({
    version: 2,
    accounts: [],
    categories: [
      {
        id: 'client-payment',
        name: 'Client payment',
        type: 'income',
        parentId: null,
        color: '#6ee7a8',
        icon: 'briefcase',
      },
      ...(
        [
          'Groceries',
          'Rent',
          'Utilities',
          'Transport',
          'Health',
          'Work tools',
          'Dining',
          'Shopping',
          'Family',
          'Giving',
          'Fees',
          'Other',
        ] as const
      ).map((name) => ({
        id: name.toLowerCase().replaceAll(' ', '-'),
        name,
        type: 'expense' as const,
        parentId: null,
        color: '#ff8a5c',
        icon: 'wallet',
        budgetGroup: (['Dining', 'Shopping', 'Other'].includes(name)
          ? 'wants'
          : name === 'Giving'
            ? 'giving'
            : 'needs') as 'needs' | 'wants' | 'giving',
      })),
    ],
    transactions: [],
    transfers: [],
    subscriptions: [],
    budgets: [],
    goals: [],
    exchangeRates: [],
    insights: [],
    allocations: [],
    reconciliations: [],
    settings: settingsSchema.parse({}),
  });
}
export function validateLedger(data: unknown): LedgerSnapshot {
  const result = ledgerSchema.safeParse(data);
  if (!result.success)
    throw new Error(
      result.error.issues
        .slice(0, 6)
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('\n'),
    );
  return result.data as LedgerSnapshot;
}

// Legacy field aliases are mapped once. Ambiguous dates remain unassigned;
// invalid financial relationships are rejected, never silently repaired.
export function normalizeLedger(input: unknown): LedgerSnapshot {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Select a valid Ember JSON archive');
  const d = input as Record<string, unknown>;
  if (!['accounts', 'categories', 'transactions', 'transfers', 'settings'].some((key) => key in d))
    throw new Error('This file does not contain an Ember ledger');
  if (d.version && !['1.0', '1.0.0', 1, 2].includes(d.version as string | number))
    throw new Error('This archive version is not supported');
  const base = emptyLedger();
  const rows = (key: string) => {
    const value = d[key] ?? base[key as keyof LedgerSnapshot];
    if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
    return value as Record<string, unknown>[];
  };
  const importedRates = rows('exchangeRates');
  const legacyRate = Number(
    importedRates.find((r) => r.fromCurrency === 'USD' && r.toCurrency === 'BDT')?.rate ?? 121.5,
  );
  return validateLedger({
    ...base,
    ...d,
    version: 2,
    accounts: rows('accounts').map((a) => ({
      ...a,
      openingBalanceMinor: Number(a.openingBalanceMinor ?? a.initialBalanceMinor ?? 0),
      archived: a.archived ?? false,
    })),
    categories: rows('categories').map((c) => ({
      ...c,
      parentId: c.parentId ?? null,
      color: c.color ?? '#94a3b8',
      icon: c.icon ?? 'wallet',
    })),
    transactions: rows('transactions').map((t) => ({
      ...t,
      categoryId: t.categoryId ?? null,
      transferId: t.transferId ?? null,
      merchant: t.merchant ?? '',
      note: t.note ?? '',
      tags: t.tags ?? [],
      paymentMethod: t.paymentMethod ?? '',
      reportingRate: t.reportingRate ?? legacyRate,
    })),
    transfers: rows('transfers').map((t) => ({
      ...t,
      amountOutMinor: t.amountOutMinor ?? t.fromAmountMinor,
      amountInMinor: t.amountInMinor ?? t.toAmountMinor,
      exchangeRate: Number(t.exchangeRate),
      createdAt: String(t.createdAt ?? t.date),
      reportingRate: t.reportingRate ?? legacyRate,
    })),
    budgets: rows('budgets').map((b) => ({
      ...b,
      month: b.month ?? (/^\d{4}-\d{2}$/.test(String(b.period)) ? b.period : 'unassigned'),
    })),
    exchangeRates: rows('exchangeRates').map((r) => ({
      ...r,
      rate: Number(r.rate),
      updatedAt: String(r.updatedAt ?? r.date ?? localDate()),
    })),
    settings: settingsSchema.parse({ ...base.settings, ...((d.settings as object) ?? {}) }),
  });
}

// Stored history remains readable even if an old app allowed future-dated postings
// or the device clock moves backward. Only effective postings affect today's money.
export function isSettled(entry: { date: string; status?: string }, today = localDate()): boolean {
  return (entry.status ?? 'done') === 'done' && entry.date <= today;
}
export function balanceOf(s: LedgerSnapshot, accountId: string): number {
  let balance = s.accounts.find((a) => a.id === accountId)?.openingBalanceMinor ?? 0;
  for (const t of s.transactions)
    if (t.accountId === accountId && isSettled(t))
      balance += t.type === 'income' ? t.amountMinor : -t.amountMinor;
  for (const t of s.transfers)
    if (isSettled(t)) {
      if (t.fromAccountId === accountId) balance -= t.amountOutMinor;
      if (t.toAccountId === accountId) balance += t.amountInMinor;
      const from = s.accounts.find((a) => a.id === t.fromAccountId);
      const feeAccount = from?.currency === t.feeCurrency ? t.fromAccountId : t.toAccountId;
      if (feeAccount === accountId) balance -= t.feeMinor;
    }
  return balance;
}
export function reservedOf(s: LedgerSnapshot, accountId: string): number {
  return (
    s.goals.filter((g) => g.accountId === accountId).reduce((n, g) => n + g.currentMinor, 0) +
    s.allocations
      .filter((a) => a.accountId === accountId && a.kind !== 'living')
      .reduce((n, a) => n + a.amountMinor, 0)
  );
}
export function availableOf(s: LedgerSnapshot, accountId: string): number {
  return balanceOf(s, accountId) - reservedOf(s, accountId);
}
