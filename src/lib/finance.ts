// ============================================================
// EMBER FINANCE OS — Finance utilities and dashboard computation
// ============================================================

import { store } from '@/lib/store';
import type {
  Currency, MoneyPair, DashboardData, CashFlowPoint,
  CategorySpending, Transaction, Account
} from '@/types';

// ── Money formatting ──

export function formatMoney(minor: number, currency: Currency | string = 'USD'): string {
  const formatted = new Intl.NumberFormat(currency === 'BDT' ? 'en-BD' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(minor / 100);
  return formatted;
}

export function formatMoneyShort(minor: number, currency: Currency = 'USD'): string {
  const value = minor / 100;
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return formatMoney(minor, currency);
}

export function paired(pair: MoneyPair | undefined, currency: 'USD' | 'BDT'): string {
  if (!pair) return formatMoney(0, currency);
  return formatMoney(currency === 'USD' ? pair.usdMinor : pair.bdtMinor, currency);
}

export function toMinor(value: string | number): number {
  return Math.round(Number(value) * 100);
}

export function fromMinor(minor: number): number {
  return minor / 100;
}

// ── Date formatting ──

export function dateLabel(value?: string): string {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01`));
}

export function shortMonth(month: string): string {
  return new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(`${month}-01`));
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Conversion helpers ──

export function getConversionRate(): number {
  const rates = store.getExchangeRates();
  const usdToBdt = rates.find(r => r.fromCurrency === 'USD' && r.toCurrency === 'BDT');
  if (usdToBdt) return usdToBdt.rate;

  const transfers = store.getTransfers();
  if (transfers.length > 0) {
    const avgRate = transfers.reduce((sum, t) => sum + t.exchangeRate, 0) / transfers.length;
    return avgRate;
  }
  return 121.5;
}

export function convertToUsd(minor: number, currency: Currency): number {
  if (currency === 'USD') return minor;
  return Math.round(minor / getConversionRate());
}

export function convertToBdt(minor: number, currency: Currency): number {
  if (currency === 'BDT') return minor;
  return Math.round(minor * getConversionRate());
}

export function toMoneyPair(minor: number, currency: Currency): MoneyPair {
  return {
    usdMinor: convertToUsd(minor, currency),
    bdtMinor: convertToBdt(minor, currency),
  };
}

// ── Account balance computation ──

export function computeAccountBalance(accountId: string): number {
  const account = store.getAccounts().find(a => a.id === accountId);
  if (!account) return 0;

  const transactions = store.getTransactions().filter(t => t.accountId === accountId && t.status === 'done');
  const transfers = store.getTransfers();

  let balance = account.openingBalanceMinor;

  for (const tx of transactions) {
    if (tx.type === 'income') balance += tx.amountMinor;
    else if (tx.type === 'expense') balance -= tx.amountMinor;
  }

  for (const tr of transfers) {
    if (tr.fromAccountId === accountId) balance -= tr.amountOutMinor + tr.feeMinor;
    if (tr.toAccountId === accountId) balance += tr.amountInMinor;
  }

  return balance;
}

// ── Dashboard computation ──

export function computeDashboard(): DashboardData {
  const accounts = store.getAccounts();
  const transactions = store.getTransactions();
  const categories = store.getCategories();
  const subscriptions = store.getSubscriptions();
  const goals = store.getGoals();
  const insights = store.getInsights();
  const budgets = store.getBudgets();
  const rate = getConversionRate();

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);

  const accountsWithBalance = accounts.map(a => ({
    ...a,
    balanceMinor: computeAccountBalance(a.id),
  }));

  let netWorthUsd = 0;
  let netWorthBdt = 0;
  for (const a of accountsWithBalance) {
    if (a.currency === 'USD') {
      netWorthUsd += a.balanceMinor;
      netWorthBdt += Math.round(a.balanceMinor * rate);
    } else {
      netWorthBdt += a.balanceMinor;
      netWorthUsd += Math.round(a.balanceMinor / rate);
    }
  }

  const thisMonthTx = transactions.filter(t => t.date.startsWith(currentMonth) && t.status === 'done');

  let incomeUsd = 0, incomeBdt = 0, expenseUsd = 0, expenseBdt = 0;
  for (const tx of thisMonthTx) {
    if (tx.type === 'income') {
      if (tx.currency === 'USD') { incomeUsd += tx.amountMinor; incomeBdt += Math.round(tx.amountMinor * rate); }
      else { incomeBdt += tx.amountMinor; incomeUsd += Math.round(tx.amountMinor / rate); }
    } else if (tx.type === 'expense') {
      if (tx.currency === 'USD') { expenseUsd += tx.amountMinor; expenseBdt += Math.round(tx.amountMinor * rate); }
      else { expenseBdt += tx.amountMinor; expenseUsd += Math.round(tx.amountMinor / rate); }
    }
  }

  const savingsRate = incomeUsd > 0 ? ((incomeUsd - expenseUsd) / incomeUsd) * 100 : 0;

  const months = new Set(transactions.filter(t => t.type === 'expense' && t.status === 'done').map(t => t.date.slice(0, 7)));
  const totalExpenseUsd = transactions
    .filter(t => t.type === 'expense' && t.status === 'done')
    .reduce((sum, t) => sum + convertToUsd(t.amountMinor, t.currency), 0);
  const avgMonthlyExpense = months.size > 0 ? totalExpenseUsd / months.size : 1;
  const runway = netWorthUsd / avgMonthlyExpense;

  const cashFlow: CashFlowPoint[] = [];
  for (let i = -5; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const m = d.toISOString().slice(0, 7);
    const monthTx = transactions.filter(t => t.date.startsWith(m) && t.status === 'done');

    let mIncUsd = 0, mIncBdt = 0, mExpUsd = 0, mExpBdt = 0;
    for (const tx of monthTx) {
      if (tx.type === 'income') {
        mIncUsd += convertToUsd(tx.amountMinor, tx.currency);
        mIncBdt += convertToBdt(tx.amountMinor, tx.currency);
      } else if (tx.type === 'expense') {
        mExpUsd += convertToUsd(tx.amountMinor, tx.currency);
        mExpBdt += convertToBdt(tx.amountMinor, tx.currency);
      }
    }
    cashFlow.push({
      month: m,
      income: { usdMinor: mIncUsd, bdtMinor: mIncBdt },
      expenses: { usdMinor: mExpUsd, bdtMinor: mExpBdt },
    });
  }

  const catSpendMap = new Map<string, number>();
  for (const tx of thisMonthTx) {
    if (tx.type === 'expense' && tx.categoryId) {
      const usdAmt = convertToUsd(tx.amountMinor, tx.currency);
      catSpendMap.set(tx.categoryId, (catSpendMap.get(tx.categoryId) || 0) + usdAmt);
    }
  }

  const totalCatSpend = Array.from(catSpendMap.values()).reduce((a, b) => a + b, 0);
  const categorySpending: CategorySpending[] = Array.from(catSpendMap.entries())
    .map(([catId, usdMinor]) => {
      const cat = categories.find(c => c.id === catId);
      return {
        categoryId: catId,
        categoryName: cat?.name || 'Unknown',
        color: cat?.color || '#94a3b8',
        amounts: { usdMinor, bdtMinor: Math.round(usdMinor * rate) },
        percentage: totalCatSpend > 0 ? (usdMinor / totalCatSpend) * 100 : 0,
      };
    })
    .sort((a, b) => b.amounts.usdMinor - a.amounts.usdMinor)
    .slice(0, 10);

  const recentTransactions = transactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)
    .map(tx => ({
      ...tx,
      categoryName: categories.find(c => c.id === tx.categoryId)?.name || 'Uncategorized',
      accountName: accounts.find(a => a.id === tx.accountId)?.name || 'Unknown',
    }));

  const currentBudgets = budgets.filter(b => b.month === currentMonth);
  const budgetsWithSpent = currentBudgets.map(b => {
    const spent = thisMonthTx
      .filter(t => t.type === 'expense' && t.categoryId === b.categoryId)
      .reduce((sum, t) => {
        if (b.currency === t.currency) return sum + t.amountMinor;
        if (b.currency === 'USD') return sum + convertToUsd(t.amountMinor, t.currency);
        return sum + convertToBdt(t.amountMinor, t.currency);
      }, 0);
    return {
      ...b,
      spentMinor: spent,
      categoryName: categories.find(c => c.id === b.categoryId)?.name || 'Unknown',
    };
  });

  const healthScore = computeHealthScore(savingsRate, budgetsWithSpent, netWorthUsd, avgMonthlyExpense, subscriptions, incomeUsd);

  return {
    netWorth: { usdMinor: netWorthUsd, bdtMinor: netWorthBdt },
    incomeThisMonth: { usdMinor: incomeUsd, bdtMinor: incomeBdt },
    expensesThisMonth: { usdMinor: expenseUsd, bdtMinor: expenseBdt },
    savingsRatePercent: savingsRate,
    runwayMonths: runway,
    healthScore,
    conversionRate: rate,
    cashFlow,
    categorySpending,
    accounts: accountsWithBalance,
    subscriptions,
    goals,
    recentTransactions,
    coachInsights: insights,
    budgets: budgetsWithSpent,
  };
}

function computeHealthScore(
  savingsRate: number,
  budgets: { spentMinor: number; limitMinor: number }[],
  netWorthUsd: number,
  avgMonthlyExpense: number,
  subscriptions: { amountMinor: number; currency: Currency; active: boolean }[],
  incomeUsd: number,
): number {
  let score = 50;

  if (savingsRate >= 30) score += 25;
  else if (savingsRate >= 20) score += 20;
  else if (savingsRate >= 10) score += 10;
  else if (savingsRate > 0) score += 5;
  else score -= 10;

  if (budgets.length > 0) {
    const overBudget = budgets.filter(b => b.spentMinor > b.limitMinor).length;
    const adherenceRate = (budgets.length - overBudget) / budgets.length;
    score += Math.round(adherenceRate * 20);
  }

  const emergencyMonths = avgMonthlyExpense > 0 ? netWorthUsd / avgMonthlyExpense : 0;
  if (emergencyMonths >= 6) score += 15;
  else if (emergencyMonths >= 3) score += 10;
  else if (emergencyMonths >= 1) score += 5;

  const totalSubUsd = subscriptions
    .filter(s => s.active)
    .reduce((sum, s) => sum + convertToUsd(s.amountMinor, s.currency), 0);
  const subPercent = incomeUsd > 0 ? (totalSubUsd / incomeUsd) * 100 : 0;
  if (subPercent > 10) score -= 10;
  else if (subPercent > 5) score -= 5;

  return Math.max(0, Math.min(100, score));
}

export function exportTransactionsCsv(): string {
  const transactions = store.getTransactions();
  const categories = store.getCategories();
  const accounts = store.getAccounts();

  const headers = ['Date', 'Type', 'Amount', 'Currency', 'Category', 'Account', 'Merchant', 'Note', 'Status', 'Tags'];
  const rows = transactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(t => [
      t.date,
      t.type,
      (t.amountMinor / 100).toFixed(2),
      t.currency,
      categories.find(c => c.id === t.categoryId)?.name || '',
      accounts.find(a => a.id === t.accountId)?.name || '',
      t.merchant,
      t.note,
      t.status,
      t.tags.join('; '),
    ]);

  return [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
}

export function downloadFile(content: string, filename: string, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
