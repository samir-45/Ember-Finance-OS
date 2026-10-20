import type { CoachInsight } from '@/types';
import { localDate, localMonth, shiftMonth } from './dates';
import {
  computeDashboard,
  computeIncomeBaseline,
  computeSubscriptionMetrics,
  formatMoney,
  getFinancialTransactions,
  reportingUsd,
} from './finance';
import { store } from './store';
export function runRulesEngine(): CoachInsight[] {
  const data = computeDashboard(),
    s = store.getSnapshot(),
    month = localMonth();
  const insights: CoachInsight[] = [];
  const add = (
    id: string,
    kind: CoachInsight['kind'],
    severity: CoachInsight['severity'],
    title: string,
    body: string,
    action?: string,
  ) =>
    insights.push({
      id,
      kind,
      severity,
      title,
      body,
      action,
      period: month,
      createdAt: new Date().toISOString(),
    });
  const target = s.settings.savingsTargetPercent ?? 20;
  if (data.incomeThisMonth.usdMinor > 0)
    add(
      'savings',
      data.savingsRatePercent >= target ? 'win' : 'warning',
      data.savingsRatePercent >= target ? 'info' : 'warning',
      `Savings rate: ${data.savingsRatePercent.toFixed(1)}%`,
      `Your recorded surplus is ${formatMoney(data.incomeThisMonth.usdMinor - data.expensesThisMonth.usdMinor, 'USD')}. Your chosen savings target is ${target}%.`,
      'Review cash flow',
    );
  else
    add(
      'income-history',
      'tip',
      'info',
      'No settled income this month',
      'Record client payments when received. Planned entries do not count toward available funds.',
    );
  if (!data.hasExpenseHistory)
    add(
      'baseline',
      'tip',
      'info',
      'Build your expense baseline',
      'Runway needs at least one complete calendar month with expense history. No health assessment is available yet.',
    );
  else
    add(
      'runway',
      data.runwayMonths >= 3 ? 'tip' : 'warning',
      data.runwayMonths >= 3 ? 'info' : 'warning',
      `${data.runwayMonths.toFixed(1)} months of estimated runway`,
      'Based on liquid balances after earmarked obligations and up to three complete months of spending. Review against your actual commitments.',
      'Review account balances',
    );
  const income = computeIncomeBaseline(s);
  const sub = computeSubscriptionMetrics(s.subscriptions, income);
  if (sub.activeCount)
    add(
      'subscriptions',
      sub.subToIncomeRatio > (s.settings.subscriptionLimitPercent ?? 5) ? 'warning' : 'tip',
      sub.subToIncomeRatio > (s.settings.subscriptionLimitPercent ?? 5) ? 'warning' : 'info',
      'Recurring cost review',
      `${sub.activeCount} active bills cost approximately ${formatMoney(sub.mreUsdMinor, 'USD')}/month.${income > 0 ? ` That is ${sub.subToIncomeRatio.toFixed(1)}% of recorded baseline income.` : ' Add income history to calculate a burden ratio.'}`,
      'Review recurring bills',
    );
  for (const budget of data.budgets.filter((b) => b.spentMinor > b.limitMinor))
    add(
      `budget:${budget.id}`,
      'warning',
      'warning',
      `${budget.categoryName} is over budget`,
      `${formatMoney(budget.spentMinor, budget.currency)} spent against ${formatMoney(budget.limitMinor, budget.currency)}.`,
      'Review category activity',
    );
  const transactions = getFinancialTransactions();
  for (const category of s.categories.filter((c) => c.type === 'expense')) {
    const history = [-3, -2, -1].map((i) => shiftMonth(month, i));
    const previous = history.map((m) =>
      transactions
        .filter(
          (t) =>
            t.status === 'done' &&
            t.date <= localDate() &&
            t.type === 'expense' &&
            t.categoryId === category.id &&
            t.date.startsWith(m),
        )
        .reduce((n, t) => n + reportingUsd(t), 0),
    );
    const avg = previous.reduce((a, b) => a + b, 0) / 3;
    const current = transactions
      .filter(
        (t) =>
          t.status === 'done' &&
          t.date <= localDate() &&
          t.type === 'expense' &&
          t.categoryId === category.id &&
          t.date.startsWith(month),
      )
      .reduce((n, t) => n + reportingUsd(t), 0);
    if (avg > 0 && current > avg * 1.3)
      add(
        `category:${category.id}`,
        'warning',
        'warning',
        `${category.name} spending increased`,
        `Current month-to-date spending is ${formatMoney(current, 'USD')} versus ${formatMoney(Math.round(avg), 'USD')} averaged over the previous three calendar months.`,
        'Review category activity',
      );
  }
  if (data.availableBdtMinor < 0)
    add(
      'overcommitted',
      'warning',
      'critical',
      'Local commitments exceed available funds',
      `The local funding gap is ${formatMoney(-data.availableBdtMinor, 'BDT')}. Review reservations, upcoming bills, and transfers before spending.`,
    );
  return insights;
}
