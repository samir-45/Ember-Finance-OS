// ============================================================
// EMBER FINANCE OS — Rules Engine (deterministic coach)
// Runs after every change and generates insights
// ============================================================

import { store } from '@/lib/store';
import { convertToUsd, getConversionRate, formatMoney, computeAccountBalance } from '@/lib/finance';
import type { CoachInsight, InsightSeverity, InsightKind } from '@/types';
import { v4 as uuid } from 'uuid';

interface InsightDraft {
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  body: string;
  action?: string;
}

export function runRulesEngine(): CoachInsight[] {
  const transactions = store.getTransactions().filter(t => t.status === 'done');
  const subscriptions = store.getSubscriptions().filter(s => s.active);
  const accounts = store.getAccounts();
  const transfers = store.getTransfers();

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const thisMonthTx = transactions.filter(t => t.date.startsWith(currentMonth));

  // Calculate totals
  const incomeUsd = thisMonthTx
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + convertToUsd(t.amountMinor, t.currency), 0);

  const expenseUsd = thisMonthTx
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + convertToUsd(t.amountMinor, t.currency), 0);

  const savingsRate = incomeUsd > 0 ? ((incomeUsd - expenseUsd) / incomeUsd) * 100 : 0;

  const insights: InsightDraft[] = [];

  // ── 1. 50/30/20 Check ──
  if (incomeUsd > 0) {
    const spendPercent = (expenseUsd / incomeUsd) * 100;
    if (savingsRate < 20) {
      insights.push({
        kind: 'warning',
        severity: 'warning',
        title: `Savings rate at ${savingsRate.toFixed(0)}%`,
        body: `Your savings rate is below the recommended 20%. You're spending ${spendPercent.toFixed(0)}% of your income. Try to cut discretionary spending.`,
        action: 'Review your biggest expense categories',
      });
    } else {
      insights.push({
        kind: 'win',
        severity: 'info',
        title: `Savings rate: ${savingsRate.toFixed(0)}% 🎉`,
        body: `You're saving more than the 20% target. Great financial discipline!`,
      });
    }
  }

  // ── 2. Category spike detection ──
  const categories = store.getCategories().filter(c => c.type === 'expense');
  for (const cat of categories) {
    // 3-month average
    const pastMonths: number[] = [];
    for (let i = -3; i < 0; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const m = d.toISOString().slice(0, 7);
      const monthTotal = transactions
        .filter(t => t.date.startsWith(m) && t.type === 'expense' && t.categoryId === cat.id)
        .reduce((sum, t) => sum + convertToUsd(t.amountMinor, t.currency), 0);
      pastMonths.push(monthTotal);
    }

    const avg = pastMonths.reduce((a, b) => a + b, 0) / Math.max(pastMonths.length, 1);
    const thisMonth = thisMonthTx
      .filter(t => t.type === 'expense' && t.categoryId === cat.id)
      .reduce((sum, t) => sum + convertToUsd(t.amountMinor, t.currency), 0);

    if (avg > 0 && thisMonth > avg * 1.3) {
      const spike = (((thisMonth - avg) / avg) * 100).toFixed(0);
      insights.push({
        kind: 'warning',
        severity: 'warning',
        title: `${cat.name} spending spiked ${spike}%`,
        body: `Your ${cat.name} spending this month (${formatMoney(thisMonth, 'USD')}) is ${spike}% above your 3-month average (${formatMoney(Math.round(avg), 'USD')}).`,
        action: `Set a ${cat.name} budget`,
      });
    }
  }

  // ── 3. Subscription creep ──
  const totalSubUsd = subscriptions.reduce(
    (sum, s) => sum + convertToUsd(s.amountMinor, s.currency),
    0
  );
  const subPercent = incomeUsd > 0 ? (totalSubUsd / incomeUsd) * 100 : 0;

  if (subPercent > 5) {
    insights.push({
      kind: 'warning',
      severity: 'warning',
      title: 'Subscription load is high',
      body: `Your subscriptions cost ${formatMoney(totalSubUsd, 'USD')}/month — ${subPercent.toFixed(1)}% of income. Consider which ones you truly use.`,
      action: 'Review subscriptions',
    });
  } else if (subscriptions.length > 0) {
    insights.push({
      kind: 'tip',
      severity: 'info',
      title: 'Subscriptions under control',
      body: `Your ${subscriptions.length} active subscriptions cost ${formatMoney(totalSubUsd, 'USD')}/month (${subPercent.toFixed(1)}% of income). Well within the 5% guideline.`,
    });
  }

  // ── 4. Emergency fund ──
  const months = new Set(transactions.filter(t => t.type === 'expense').map(t => t.date.slice(0, 7)));
  const totalAllExpenseUsd = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + convertToUsd(t.amountMinor, t.currency), 0);
  const avgMonthlyExpense = months.size > 0 ? totalAllExpenseUsd / months.size : 0;

  let netWorthUsd = 0;
  for (const a of accounts) {
    const balance = computeAccountBalance(a.id);
    netWorthUsd += convertToUsd(balance, a.currency);
  }

  const emergencyMonths = avgMonthlyExpense > 0 ? netWorthUsd / avgMonthlyExpense : 0;

  if (emergencyMonths < 3) {
    insights.push({
      kind: 'warning',
      severity: 'critical',
      title: 'Emergency fund below 3 months',
      body: `Your current balances cover ${emergencyMonths.toFixed(1)} months of expenses. Aim for 3-6 months of runway for financial security.`,
      action: 'Set up an emergency fund goal',
    });
  } else if (emergencyMonths >= 6) {
    insights.push({
      kind: 'win',
      severity: 'info',
      title: 'Strong emergency fund!',
      body: `You have ${emergencyMonths.toFixed(1)} months of expenses covered. That's a solid safety net.`,
    });
  }

  // ── 5. Conversion rate check ──
  if (transfers.length >= 2) {
    const avgRate = transfers.reduce((sum, t) => sum + t.exchangeRate, 0) / transfers.length;
    const lastTransfer = [...transfers].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (lastTransfer && lastTransfer.exchangeRate < avgRate * 0.98) {
      const diff = (((avgRate - lastTransfer.exchangeRate) / avgRate) * 100).toFixed(1);
      insights.push({
        kind: 'tip',
        severity: 'info',
        title: 'Below-average conversion rate',
        body: `Your last conversion was at ${lastTransfer.exchangeRate.toFixed(2)} BDT/USD — ${diff}% below your average of ${avgRate.toFixed(2)}. Try to time conversions better.`,
      });
    }
  }

  // ── 6. Fee drag ──
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const quarterFees = transfers
    .filter(t => new Date(t.date) >= quarterStart)
    .reduce((sum, t) => sum + convertToUsd(t.feeMinor, t.feeCurrency), 0);

  if (quarterFees > 1000) { // > $10 in fees
    insights.push({
      kind: 'tip',
      severity: 'info',
      title: `${formatMoney(quarterFees, 'USD')} in conversion fees this quarter`,
      body: 'Consider consolidating your conversions into fewer, larger transfers to reduce per-transaction fees.',
    });
  }

  // Convert to full CoachInsight objects
  return insights.map(draft => ({
    ...draft,
    id: uuid(),
    period: currentMonth,
    createdAt: new Date().toISOString(),
  }));
}
