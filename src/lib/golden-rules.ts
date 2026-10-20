import {
  computeDashboard,
  computeIncomeBaseline,
  computeSubscriptionMetrics,
  formatMoney,
} from './finance';
import { availableOf } from './ledger';
import { store } from './store';
export type RuleStatus = 'pass' | 'warning' | 'fail';
export interface GoldenRuleResult {
  id: string;
  number: number;
  name: string;
  principle: string;
  benchmark: string;
  currentValueFormatted: string;
  currentNumericValue: number;
  benchmarkNumericValue: number;
  unit: string;
  status: RuleStatus;
  statusLabel: string;
  explanation: string;
  advisorPrescription: string;
  actionUrl?: string;
  actionLabel?: string;
}
export interface GoldenRulesAudit {
  compositeScore: number;
  letterGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' | '—';
  gradeTitle: string;
  gradeDescription: string;
  passedCount: number;
  warningCount: number;
  failCount: number;
  rules: GoldenRuleResult[];
  keyStrengths: string[];
  immediateActions: string[];
}
export function auditGoldenRules(): GoldenRulesAudit {
  const s = store.getSnapshot(),
    d = computeDashboard();
  const rules: GoldenRuleResult[] = [];
  const add = (
    id: string,
    name: string,
    current: number,
    target: number,
    value: string,
    benchmark: string,
    pass: boolean,
    explanation: string,
    actionUrl: string,
  ) =>
    rules.push({
      id,
      number: rules.length + 1,
      name,
      principle: explanation,
      benchmark,
      currentValueFormatted: value,
      currentNumericValue: current,
      benchmarkNumericValue: target,
      unit: '',
      status: pass ? 'pass' : 'warning',
      statusLabel: pass ? 'Within target' : 'Review',
      explanation,
      advisorPrescription: pass
        ? 'Review this alongside your actual account statements and commitments.'
        : 'Check the underlying entries and adjust your plan.',
      actionUrl,
      actionLabel: 'Review records',
    });
  if (d.incomeThisMonth.usdMinor > 0)
    add(
      'surplus',
      'Recorded savings rate',
      d.savingsRatePercent,
      s.settings.savingsTargetPercent ?? 20,
      `${d.savingsRatePercent.toFixed(1)}%`,
      `Your target: ${s.settings.savingsTargetPercent ?? 20}%`,
      d.savingsRatePercent >= (s.settings.savingsTargetPercent ?? 20),
      'Income minus expenses and transfer fees, divided by income. Internal transfers are excluded.',
      '/reports',
    );
  if (d.hasExpenseHistory)
    add(
      'runway',
      'Estimated runway',
      d.runwayMonths,
      3,
      `${d.runwayMonths.toFixed(1)} months`,
      'Review against your personal reserve plan',
      d.runwayMonths >= 3,
      'Uses up to three complete calendar months of expenses and liquid balances after earmarked obligations.',
      '/accounts',
    );
  const sub = computeSubscriptionMetrics(s.subscriptions, computeIncomeBaseline(s));
  if (computeIncomeBaseline(s) > 0 && sub.activeCount)
    add(
      'bills',
      'Monthly recurring costs',
      sub.subToIncomeRatio,
      s.settings.subscriptionLimitPercent ?? 5,
      `${sub.subToIncomeRatio.toFixed(1)}%`,
      `Your target: ${s.settings.subscriptionLimitPercent ?? 5}%`,
      sub.subToIncomeRatio <= (s.settings.subscriptionLimitPercent ?? 5),
      'Yearly, quarterly, monthly, and weekly bills are normalized to a monthly estimate.',
      '/subscriptions',
    );
  if (d.budgets.length)
    add(
      'budgets',
      'Current month budget limits',
      d.budgets.filter((b) => b.spentMinor > b.limitMinor).length,
      0,
      `${d.budgets.filter((b) => b.spentMinor > b.limitMinor).length} over limit`,
      'Your category limits',
      d.budgets.every((b) => b.spentMinor <= b.limitMinor),
      'Category spending includes descendants and transfer fees classified to fees.',
      '/budgets',
    );
  if (s.accounts.length)
    add(
      'funding',
      'Reservation funding',
      d.availableBdtMinor,
      0,
      formatMoney(d.availableBdtMinor, 'BDT'),
      'Nonnegative uncommitted local funds',
      s.accounts.every((a) => availableOf(s, a.id) >= 0) && d.availableBdtMinor >= 0,
      'A negative amount means current commitments exceed the funds in their accounts.',
      '/allocations',
    );
  if (s.goals.length)
    add(
      'goals',
      'Verified goal funding',
      s.goals.filter((g) => g.accountId).length,
      s.goals.length,
      `${s.goals.filter((g) => g.accountId).length}/${s.goals.length} linked`,
      'Goals linked to actual accounts',
      s.goals.every((g) => !!g.accountId),
      'Unlinked historical goal amounts are self-reported and excluded from funded reserves.',
      '/goals',
    );
  if (s.accounts.length)
    add(
      'reconciliation',
      'Statement reconciliation',
      s.accounts.filter((a) => a.reconciledAt).length,
      s.accounts.length,
      `${s.accounts.filter((a) => a.reconciledAt).length}/${s.accounts.length} checked`,
      'Match each account to a statement',
      s.accounts.every((a) => !!a.reconciledAt),
      'Reconciliation records the balance comparison without inventing an adjustment transaction.',
      '/accounts',
    );
  const passedCount = rules.filter((r) => r.status === 'pass').length,
    warningCount = rules.length - passedCount;
  const compositeScore =
    d.hasExpenseHistory && rules.length ? Math.round((passedCount / rules.length) * 100) : 0;
  return {
    rules,
    compositeScore,
    passedCount,
    warningCount,
    failCount: 0,
    letterGrade: !d.hasExpenseHistory
      ? '—'
      : compositeScore >= 80
        ? 'A'
        : compositeScore >= 60
          ? 'B'
          : 'C',
    gradeTitle: !d.hasExpenseHistory ? 'Building your baseline' : 'Your personal plan checks',
    gradeDescription: !d.hasExpenseHistory
      ? 'Record a complete calendar month of expenses before interpreting a financial score.'
      : 'These are checks against recorded data and your preferences, not a prediction of financial security.',
    keyStrengths: rules.filter((r) => r.status === 'pass').map((r) => r.name),
    immediateActions: rules
      .filter((r) => r.status !== 'pass')
      .map((r) => `${r.name}: ${r.advisorPrescription}`),
  };
}
