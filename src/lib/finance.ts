import type {
  AccountType,
  Category,
  Currency,
  DashboardData,
  LedgerSnapshot,
  MoneyPair,
  Subscription,
  Transaction,
} from '@/types';
import { daysBetween, localDate, localMonth, shiftMonth } from './dates';
import { availableOf, balanceOf, isSettled, reservedOf } from './ledger';
import { store } from './store';

export function formatMoney(minor: number, currency: Currency | string = 'USD'): string {
  return new Intl.NumberFormat(currency === 'BDT' ? 'en-BD' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format((Number.isFinite(minor) ? minor : 0) / 100);
}
export function formatMoneyShort(minor: number, currency: Currency = 'USD'): string {
  const value = minor / 100;
  const symbol = currency === 'USD' ? '$' : '৳';
  return Math.abs(value) >= 1000000
    ? `${symbol}${(value / 1000000).toFixed(1)}M`
    : Math.abs(value) >= 1000
      ? `${symbol}${(value / 1000).toFixed(1)}K`
      : formatMoney(minor, currency);
}
export const paired = (pair: MoneyPair | undefined, currency: Currency) =>
  formatMoney(pair ? (currency === 'USD' ? pair.usdMinor : pair.bdtMinor) : 0, currency);
export function toMinor(value: string | number): number {
  const text = String(value).trim();
  const match = /^([+-]?)(\d*)(?:\.(\d{0,2}))?$/.exec(text);
  if (!match || !(match[2] || match[3]))
    throw new Error('Enter an amount with at most two decimal places');
  const minor =
    (BigInt(match[2] || '0') * 100n + BigInt((match[3] || '').padEnd(2, '0'))) *
    (match[1] === '-' ? -1n : 1n);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER) || minor < BigInt(Number.MIN_SAFE_INTEGER))
    throw new Error('Amount exceeds the supported range');
  return Number(minor);
}
export const fromMinor = (minor: number) => minor / 100;
export const accountTypeLabel = (type: AccountType) =>
  type === 'receivable' ? 'Lent out (owed to me)' : type;
export function dateLabel(value?: string): string {
  return value
    ? new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Dhaka',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
    : 'Not set';
}
export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('en', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
export const shortMonth = (month: string) =>
  new Intl.DateTimeFormat('en', { timeZone: 'UTC', month: 'short' }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
export const daysUntil = (date: string) => daysBetween(localDate(), date);
export const getConversionRate = () => store.getReferenceRate();
export const convertToUsd = (
  minor: number,
  currency: Currency,
  rate = getConversionRate(),
): number => (currency === 'USD' ? minor : Math.round(minor / rate));
export const convertToBdt = (
  minor: number,
  currency: Currency,
  rate = getConversionRate(),
): number => (currency === 'BDT' ? minor : Math.round(minor * rate));
export const toMoneyPair = (
  minor: number,
  currency: Currency,
  rate = getConversionRate(),
): MoneyPair => ({
  usdMinor: convertToUsd(minor, currency, rate),
  bdtMinor: convertToBdt(minor, currency, rate),
});
export const computeAccountBalance = (id: string) => balanceOf(store.getSnapshot(), id);
export function categoryContains(
  parentId: string,
  categoryId: string | null,
  categories = store.getCategories(),
): boolean {
  const seen = new Set<string>();
  let current = categoryId;
  while (current && !seen.has(current)) {
    if (current === parentId) return true;
    seen.add(current);
    current = categories.find((c) => c.id === current)?.parentId ?? null;
  }
  return false;
}

// Fees are derived from transfers exactly once. Principal movements remain excluded
// from income and spending; the ledger view exposes both principal legs separately.
export function getFinancialTransactions(s = store.getSnapshot()): Transaction[] {
  const feeCategory =
    s.categories.find((c) => ['fees', 'taxes & fees'].includes(c.name.toLowerCase()))?.id ?? null;
  return [
    ...s.transactions,
    ...s.transfers
      .filter((t) => t.feeMinor > 0)
      .map((t) => {
        const from = s.accounts.find((a) => a.id === t.fromAccountId)!;
        return {
          id: `fee:${t.id}`,
          accountId: from.currency === t.feeCurrency ? t.fromAccountId : t.toAccountId,
          categoryId: feeCategory,
          transferId: t.id,
          type: 'expense' as const,
          amountMinor: t.feeMinor,
          currency: t.feeCurrency,
          merchant: 'Transfer fee',
          note: t.note ?? '',
          date: t.date,
          tags: ['transfer-fee'],
          paymentMethod: 'Transfer',
          status: t.status ?? 'done',
          createdAt: t.createdAt,
          reportingRate: t.reportingRate ?? t.exchangeRate,
        };
      }),
  ];
}
export type LedgerEntry = Transaction & { direction?: 'in' | 'out' };
export function getLedgerEntries(s = store.getSnapshot()): LedgerEntry[] {
  return [
    ...getFinancialTransactions(s),
    ...s.transfers.flatMap((t) => {
      const from = s.accounts.find((a) => a.id === t.fromAccountId)!,
        to = s.accounts.find((a) => a.id === t.toAccountId)!;
      const base = {
        categoryId: null,
        transferId: t.id,
        type: 'transfer' as const,
        note: t.note ?? '',
        date: t.date,
        tags: ['transfer'],
        paymentMethod: 'Transfer',
        status: t.status ?? 'done',
        createdAt: t.createdAt,
      };
      return [
        {
          ...base,
          id: `out:${t.id}`,
          accountId: from.id,
          amountMinor: t.amountOutMinor,
          currency: from.currency,
          merchant: `Transfer to ${to.name}`,
          direction: 'out' as const,
        },
        {
          ...base,
          id: `in:${t.id}`,
          accountId: to.id,
          amountMinor: t.amountInMinor,
          currency: to.currency,
          merchant: `Transfer from ${from.name}`,
          direction: 'in' as const,
        },
      ];
    }),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}
export const reportingUsd = (t: Transaction) =>
  convertToUsd(t.amountMinor, t.currency, t.reportingRate ?? 121.5);
export const reportingBdt = (t: Transaction) =>
  convertToBdt(t.amountMinor, t.currency, t.reportingRate ?? 121.5);
export function monthlyTotals(month: string, s = store.getSnapshot()) {
  const rows = getFinancialTransactions(s).filter((t) => t.date.startsWith(month) && isSettled(t));
  const sum = (type: string, convert: (t: Transaction) => number) =>
    rows.filter((t) => t.type === type).reduce((n, t) => n + convert(t), 0);
  return {
    month,
    income: { usdMinor: sum('income', reportingUsd), bdtMinor: sum('income', reportingBdt) },
    expenses: { usdMinor: sum('expense', reportingUsd), bdtMinor: sum('expense', reportingBdt) },
  };
}
export function uncoveredBills(s: LedgerSnapshot, accountId: string): number {
  const due = s.subscriptions
    .filter(
      (b) => b.active && b.accountId === accountId && b.nextBillingDate <= `${localMonth()}-31`,
    )
    .reduce((n, b) => n + b.amountMinor, 0);
  const reserved = s.allocations
    .filter((a) => a.accountId === accountId && a.kind === 'bills')
    .reduce((n, a) => n + a.amountMinor, 0);
  return Math.max(0, due - reserved);
}
export function computeRunway(s = store.getSnapshot()) {
  const month = localMonth();
  const expense = getFinancialTransactions(s).filter(
    (t) => t.type === 'expense' && isSettled(t) && t.date.slice(0, 7) < month,
  );
  const first = expense.map((t) => t.date.slice(0, 7)).sort()[0];
  const periods = [-3, -2, -1].map((i) => shiftMonth(month, i)).filter((m) => first && m >= first);
  const burn = periods.length
    ? periods.reduce((n, m) => n + monthlyTotals(m, s).expenses.usdMinor, 0) / periods.length
    : 0;
  // Emergency reserves remain available for runway; purchase goals and money lent out do not.
  const reserve = s.accounts
    .filter((a) => a.type !== 'receivable')
    .reduce(
      (n, a) =>
        n +
        convertToUsd(
          balanceOf(s, a.id) -
            s.allocations
              .filter((x) => x.accountId === a.id && x.kind !== 'living')
              .reduce((v, x) => v + x.amountMinor, 0) -
            s.goals
              .filter((g) => g.accountId === a.id && !g.isEmergency)
              .reduce((v, g) => v + g.currentMinor, 0) -
            uncoveredBills(s, a.id),
          a.currency,
        ),
      0,
    );
  return {
    hasHistory: burn > 0,
    averageMonthlyUsdMinor: burn,
    months: burn > 0 ? Math.max(0, reserve) / burn : 0,
    baselineMonths: periods.length,
  };
}
export function computeIncomeBaseline(s = store.getSnapshot()): number {
  const month = localMonth();
  const first = s.transactions
    .filter((t) => t.type === 'income' && isSettled(t))
    .map((t) => t.date.slice(0, 7))
    .sort()[0];
  const periods = [-3, -2, -1].map((i) => shiftMonth(month, i)).filter((m) => first && m >= first);
  return periods.length
    ? periods.reduce((n, m) => n + monthlyTotals(m, s).income.usdMinor, 0) / periods.length
    : monthlyTotals(month, s).income.usdMinor;
}
export function monthlySubscriptionMinor(
  s: Pick<Subscription, 'amountMinor' | 'billingCycle'>,
): number {
  return Math.round(
    s.amountMinor *
      (s.billingCycle === 'yearly'
        ? 1 / 12
        : s.billingCycle === 'quarterly'
          ? 1 / 3
          : s.billingCycle === 'weekly'
            ? 52 / 12
            : 1),
  );
}
export interface SubscriptionMetrics {
  mreUsdMinor: number;
  arrUsdMinor: number;
  mreBdtMinor: number;
  arrBdtMinor: number;
  activeCount: number;
  pausedCount: number;
  subToIncomeRatio: number;
}
export function computeSubscriptionMetrics(
  subs: { amountMinor: number; currency: Currency; billingCycle: string; active: boolean }[],
  income: number,
  rate = getConversionRate(),
): SubscriptionMetrics {
  const mreUsdMinor = subs
    .filter((s) => s.active)
    .reduce(
      (n, s) =>
        n +
        convertToUsd(
          monthlySubscriptionMinor({
            amountMinor: s.amountMinor,
            billingCycle: s.billingCycle as Subscription['billingCycle'],
          }),
          s.currency,
          rate,
        ),
      0,
    );
  return {
    mreUsdMinor,
    arrUsdMinor: mreUsdMinor * 12,
    mreBdtMinor: Math.round(mreUsdMinor * rate),
    arrBdtMinor: Math.round(mreUsdMinor * rate) * 12,
    activeCount: subs.filter((s) => s.active).length,
    pausedCount: subs.filter((s) => !s.active).length,
    subToIncomeRatio: income > 0 ? (mreUsdMinor / income) * 100 : 0,
  };
}
export function computeDashboard(): DashboardData {
  const s = store.getSnapshot(),
    month = localMonth(),
    rate = getConversionRate();
  const rows = getFinancialTransactions(s).filter((t) => isSettled(t) && t.date.startsWith(month));
  const totals = monthlyTotals(month, s),
    runway = computeRunway(s);
  const accounts = s.accounts.map((a) => ({ ...a, balanceMinor: balanceOf(s, a.id) }));
  const netWorth = accounts.reduce(
    (n, a) => {
      n.usdMinor += convertToUsd(a.balanceMinor, a.currency, rate);
      n.bdtMinor += convertToBdt(a.balanceMinor, a.currency, rate);
      return n;
    },
    { usdMinor: 0, bdtMinor: 0 },
  );
  const savingsRate =
    totals.income.usdMinor > 0
      ? ((totals.income.usdMinor - totals.expenses.usdMinor) / totals.income.usdMinor) * 100
      : 0;
  const budgets = s.budgets
    .filter((b) => b.month === month)
    .map((b) => ({
      ...b,
      spentMinor: rows
        .filter(
          (t) => t.type === 'expense' && categoryContains(b.categoryId, t.categoryId, s.categories),
        )
        .reduce((n, t) => n + (b.currency === 'USD' ? reportingUsd(t) : reportingBdt(t)), 0),
      categoryName: s.categories.find((c) => c.id === b.categoryId)?.name ?? 'Unknown',
    }));
  const subscription = computeSubscriptionMetrics(s.subscriptions, computeIncomeBaseline(s), rate);
  const healthScore = runway.hasHistory
    ? Math.max(
        0,
        Math.min(
          100,
          40 +
            Math.min(25, Math.max(-20, savingsRate)) +
            Math.min(20, (runway.months / 6) * 20) +
            (budgets.length
              ? (budgets.filter((b) => b.spentMinor <= b.limitMinor).length / budgets.length) * 15
              : 0) -
            (subscription.subToIncomeRatio > (s.settings.subscriptionLimitPercent ?? 5) ? 10 : 0),
        ),
      )
    : 0;
  const spend = new Map<string, { usdMinor: number; bdtMinor: number }>();
  for (const t of rows.filter((t) => t.type === 'expense')) {
    const key = t.categoryId ?? 'uncategorized';
    const amount = spend.get(key) ?? { usdMinor: 0, bdtMinor: 0 };
    amount.usdMinor += reportingUsd(t);
    amount.bdtMinor += reportingBdt(t);
    spend.set(key, amount);
  }
  const totalSpend = [...spend.values()].reduce((n, v) => n + v.bdtMinor, 0);
  const due = s.subscriptions.filter((b) => b.active && b.nextBillingDate <= `${month}-31`);
  const dueByAccount = (id: string) =>
    due.filter((b) => b.accountId === id).reduce((n, b) => n + b.amountMinor, 0);
  const availableBdtMinor = accounts
    .filter((a) => a.currency === 'BDT' && !a.archived && a.type !== 'receivable')
    .reduce((n, a) => {
      const billReserves = s.allocations
        .filter((x) => x.accountId === a.id && x.kind === 'bills')
        .reduce((v, x) => v + x.amountMinor, 0);
      return n + availableOf(s, a.id) - Math.max(0, dueByAccount(a.id) - billReserves);
    }, 0);
  return {
    netWorth,
    incomeThisMonth: totals.income,
    expensesThisMonth: totals.expenses,
    savingsRatePercent: savingsRate,
    runwayMonths: runway.months,
    hasExpenseHistory: runway.hasHistory,
    healthScore: Math.round(healthScore),
    conversionRate: rate,
    cashFlow: [-5, -4, -3, -2, -1, 0].map((i) => monthlyTotals(shiftMonth(month, i), s)),
    categorySpending: [...spend]
      .map(([categoryId, amounts]) => ({
        categoryId,
        categoryName: s.categories.find((c) => c.id === categoryId)?.name ?? 'Uncategorized',
        color: s.categories.find((c) => c.id === categoryId)?.color ?? '#94a3b8',
        amounts,
        percentage: totalSpend > 0 ? (amounts.bdtMinor / totalSpend) * 100 : 0,
      }))
      .sort((a, b) => b.amounts.bdtMinor - a.amounts.bdtMinor),
    accounts,
    subscriptions: [...s.subscriptions].sort((a, b) =>
      a.nextBillingDate.localeCompare(b.nextBillingDate),
    ),
    goals: s.goals,
    recentTransactions: getLedgerEntries(s)
      .slice(0, 10)
      .map((t) => ({
        ...t,
        categoryName:
          s.categories.find((c) => c.id === t.categoryId)?.name ??
          (t.type === 'transfer' ? 'Transfer' : 'Uncategorized'),
        accountName: s.accounts.find((a) => a.id === t.accountId)?.name ?? 'Unknown',
      })),
    coachInsights: [],
    budgets,
    availableBdtMinor,
    reservedBdtMinor: accounts
      .filter((a) => a.currency === 'BDT')
      .reduce((n, a) => n + reservedOf(s, a.id), 0),
    billsDueBdtMinor: due.reduce((n, b) => n + convertToBdt(b.amountMinor, b.currency, rate), 0),
    givingReservedBdtMinor: s.allocations
      .filter((a) => a.kind === 'zakat' || a.kind === 'sadaqah')
      .reduce(
        (n, a) =>
          n +
          convertToBdt(a.amountMinor, s.accounts.find((x) => x.id === a.accountId)!.currency, rate),
        0,
      ),
    givingPaidBdtMinor: rows.filter((t) => t.givingKind).reduce((n, t) => n + reportingBdt(t), 0),
  };
}
export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function exportTransactionsCsv(): string {
  const s = store.getSnapshot();
  const headers = [
    'ID',
    'Date',
    'Type',
    'Direction',
    'Amount',
    'Currency',
    'Category',
    'Account',
    'Merchant',
    'Note',
    'Status',
    'Tags',
    'Transfer ID',
    'Reporting BDT per USD',
  ];
  const rows = getLedgerEntries(s).map((t) => [
    t.id,
    t.date,
    t.type,
    t.direction ?? '',
    (t.amountMinor / 100).toFixed(2),
    t.currency,
    s.categories.find((c) => c.id === t.categoryId)?.name ?? '',
    s.accounts.find((a) => a.id === t.accountId)?.name ?? '',
    t.merchant,
    t.note,
    t.status,
    t.tags.join('; '),
    t.transferId ?? '',
    t.reportingRate ?? '',
  ]);
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
export function downloadFile(content: string, filename: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export interface BudgetPacing {
  pacingPercentage: number;
  projectedMonthEndMinor: number;
  dailyAllowanceMinor: number;
  daysRemaining: number;
  status: 'under' | 'on_track' | 'warning' | 'exceeded';
}
export function computeBudgetPacing(spent: number, limit: number, date = new Date()): BudgetPacing {
  const [year, month, day] = localDate(date).split('-').map(Number),
    total = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daysRemaining = total - day + 1,
    pacingPercentage = limit > 0 ? (spent / limit / (day / total)) * 100 : 0;
  return {
    pacingPercentage,
    projectedMonthEndMinor: Math.round((spent / day) * total),
    dailyAllowanceMinor: Math.floor(Math.max(0, limit - spent) / daysRemaining),
    daysRemaining,
    status:
      spent >= limit
        ? 'exceeded'
        : pacingPercentage > 115
          ? 'warning'
          : pacingPercentage < 85
            ? 'under'
            : 'on_track',
  };
}
export interface SinkingFundCalculation {
  monthsRemaining: number;
  monthlyDepositMinor: number;
  projectedShortfallMinor: number;
  isCompleted: boolean;
  isBehind: boolean;
}
export function computeSinkingFund(
  target: number,
  current: number,
  deadline?: string | null,
): SinkingFundCalculation {
  const gap = Math.max(0, target - current),
    days = deadline ? daysUntil(deadline) : 365,
    months = gap > 0 ? Math.max(1, Math.ceil(days / 30.4)) : 0;
  return {
    monthsRemaining: months,
    monthlyDepositMinor: gap > 0 ? Math.ceil(gap / months) : 0,
    projectedShortfallMinor: gap,
    isCompleted: gap === 0,
    isBehind: gap > 0 && days < 0,
  };
}
export interface BucketAnalysis {
  name: 'Needs' | 'Wants' | 'Savings';
  targetPct: number;
  actualPct: number;
  amountUsdMinor: number;
  amountBdtMinor: number;
  status: 'optimal' | 'elevated' | 'underfunded';
}
export function compute503020Analysis(
  rows: Transaction[],
  categories: Pick<Category, 'id' | 'name' | 'budgetGroup'>[],
  rate = getConversionRate(),
): {
  needs: BucketAnalysis;
  wants: BucketAnalysis;
  savings: BucketAnalysis;
  totalIncomeUsdMinor: number;
} {
  const done = rows.filter((t) => isSettled(t));
  const income = done.filter((t) => t.type === 'income').reduce((n, t) => n + reportingUsd(t), 0);
  let needs = 0,
    wants = 0,
    spending = 0;
  for (const t of done.filter((t) => t.type === 'expense')) {
    const group = categories.find((c) => c.id === t.categoryId)?.budgetGroup ?? 'wants';
    const value = reportingUsd(t);
    spending += value;
    if (group === 'needs' || group === 'giving') needs += value;
    else wants += value;
  }
  const bucket = (
    name: BucketAnalysis['name'],
    amount: number,
    targetPct: number,
  ): BucketAnalysis => {
    const actualPct = income > 0 ? (amount / income) * 100 : 0;
    return {
      name,
      targetPct,
      actualPct,
      amountUsdMinor: amount,
      amountBdtMinor: Math.round(amount * rate),
      status:
        name === 'Savings'
          ? actualPct >= targetPct
            ? 'optimal'
            : 'underfunded'
          : actualPct <= targetPct
            ? 'optimal'
            : 'elevated',
    };
  };
  return {
    needs: bucket('Needs', needs, 50),
    wants: bucket('Wants', wants, 30),
    savings: bucket('Savings', income - spending, store.getSettings().savingsTargetPercent ?? 20),
    totalIncomeUsdMinor: income,
  };
}
