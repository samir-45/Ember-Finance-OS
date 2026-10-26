import type { CoachInsight } from '@/types';
import { localDate, localMonth, shiftMonth } from './dates';
import {
  computeDashboard,
  computeIncomeBaseline,
  computeSubscriptionMetrics,
  formatMoney,
  getFinancialTransactions,
  paired,
  reportingBdt,
  reportingUsd,
} from './finance';
import { isSettled } from './ledger';
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
  const currency = s.settings.baseCurrency;
  const reporting = currency === 'USD' ? reportingUsd : reportingBdt;
  const target = s.settings.savingsTargetPercent ?? 20;
  if (data.incomeThisMonth.usdMinor > 0)
    add(
      'savings',
      data.savingsRatePercent >= target ? 'win' : 'warning',
      data.savingsRatePercent >= target ? 'info' : 'warning',
      `Savings rate: ${data.savingsRatePercent.toFixed(1)}%`,
      `Your recorded surplus is ${paired({ usdMinor: data.incomeThisMonth.usdMinor - data.expensesThisMonth.usdMinor, bdtMinor: data.incomeThisMonth.bdtMinor - data.expensesThisMonth.bdtMinor }, currency)}. Your chosen savings target is ${target}%.`,
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
      `${sub.activeCount} active bills cost approximately ${paired({ usdMinor: sub.mreUsdMinor, bdtMinor: sub.mreBdtMinor }, currency)}/month.${income > 0 ? ` That is ${sub.subToIncomeRatio.toFixed(1)}% of recorded baseline income.` : ' Add income history to calculate a burden ratio.'}`,
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
  // Months before the first recorded expense are not tracked, so they must not count as zero.
  const first = transactions
    .filter((t) => t.type === 'expense' && isSettled(t))
    .map((t) => t.date.slice(0, 7))
    .sort()[0];
  const history = [-3, -2, -1].map((i) => shiftMonth(month, i)).filter((m) => first && m >= first);
  for (const category of s.categories.filter((c) => c.type === 'expense')) {
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
        .reduce((n, t) => n + reporting(t), 0),
    );
    const avg = history.length ? previous.reduce((a, b) => a + b, 0) / history.length : 0;
    const current = transactions
      .filter(
        (t) =>
          t.status === 'done' &&
          t.date <= localDate() &&
          t.type === 'expense' &&
          t.categoryId === category.id &&
          t.date.startsWith(month),
      )
      .reduce((n, t) => n + reporting(t), 0);
    if (avg > 0 && current > avg * 1.3)
      add(
        `category:${category.id}`,
        'warning',
        'warning',
        `${category.name} spending increased`,
        `Current month-to-date spending is ${formatMoney(current, currency)} versus ${formatMoney(Math.round(avg), currency)} averaged over the previous ${history.length === 1 ? 'month' : `${history.length} months`}.`,
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
