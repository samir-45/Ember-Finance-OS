// ============================================================
// EMBER FINANCE OS — Golden Rules Financial Analyst & Advisor Engine
// Deterministic personal finance algorithmic analysis based on
// standard, time-tested money management principles.
// Works 100% offline without external AI dependencies.
// ============================================================

import { store } from '@/lib/store';
import {
  convertToUsd,
  convertToBdt,
  getConversionRate,
  formatMoney,
  computeAccountBalance,
} from '@/lib/finance';

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
  compositeScore: number; // 0 to 100
  letterGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  gradeTitle: string;
  gradeDescription: string;
  passedCount: number;
  warningCount: number;
  failCount: number;
  rules: GoldenRuleResult[];
  keyStrengths: string[];
  immediateActions: string[];
}

/**
 * Executes a full audit against the 7 Golden Rules of Money Management
 */
export function auditGoldenRules(): GoldenRulesAudit {
  const transactions = store.getTransactions().filter(t => t.status === 'done');
  const subscriptions = store.getSubscriptions().filter(s => s.active);
  const accounts = store.getAccounts();
  const transfers = store.getTransfers();
  const goals = store.getGoals();
  const categories = store.getCategories();
  const rate = getConversionRate();

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const thisMonthTx = transactions.filter(t => t.date.startsWith(currentMonth));

  // ── Baseline Inflows & Outflows ──
  const thisMonthIncomeUsd = thisMonthTx
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + convertToUsd(t.amountMinor, t.currency), 0);

  const thisMonthExpenseUsd = thisMonthTx
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + convertToUsd(t.amountMinor, t.currency), 0);

  // Fallback to 6-month average if current month has low activity
  const allMonths = Array.from(new Set(transactions.map(t => t.date.slice(0, 7))));
  const totalHistoricalIncomeUsd = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + convertToUsd(t.amountMinor, t.currency), 0);
  const avgMonthlyIncomeUsd = allMonths.length > 0 ? totalHistoricalIncomeUsd / allMonths.length : thisMonthIncomeUsd;

  const baselineIncomeUsd = thisMonthIncomeUsd > 0 ? thisMonthIncomeUsd : Math.max(avgMonthlyIncomeUsd, 1);

  // ── Total Liquid Net Worth ──
  let totalNetWorthUsd = 0;
  for (const a of accounts) {
    const bal = computeAccountBalance(a.id);
    totalNetWorthUsd += convertToUsd(bal, a.currency);
  }

  // ── Average Monthly Burn ──
  const expenseMonths = Array.from(new Set(transactions.filter(t => t.type === 'expense').map(t => t.date.slice(0, 7))));
  const totalHistoricalExpenseUsd = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + convertToUsd(t.amountMinor, t.currency), 0);
  const avgMonthlyBurnUsd = expenseMonths.length > 0 ? totalHistoricalExpenseUsd / expenseMonths.length : Math.max(thisMonthExpenseUsd, 1);

  const rules: GoldenRuleResult[] = [];

  // ─────────────────────────────────────────────────────────────
  // 1. RULE #1: PAY YOURSELF FIRST (The 20% Savings Rule)
  // ─────────────────────────────────────────────────────────────
  const savingsRate = thisMonthIncomeUsd > 0
    ? ((thisMonthIncomeUsd - thisMonthExpenseUsd) / thisMonthIncomeUsd) * 100
    : 0;

  let r1Status: RuleStatus = 'fail';
  if (savingsRate >= 20) r1Status = 'pass';
  else if (savingsRate >= 10) r1Status = 'warning';

  rules.push({
    id: 'rule_savings_rate',
    number: 1,
    name: 'Pay Yourself First (20% Rule)',
    principle: 'Direct at least 20% of all incoming capital into savings or investments before discretionary spending.',
    benchmark: '≥ 20.0%',
    currentValueFormatted: `${savingsRate.toFixed(1)}%`,
    currentNumericValue: savingsRate,
    benchmarkNumericValue: 20,
    unit: '%',
    status: r1Status,
    statusLabel: r1Status === 'pass' ? 'Healthy Surplus' : r1Status === 'warning' ? 'Moderate Drag' : 'Below Target',
    explanation: r1Status === 'pass'
      ? `You are currently saving ${savingsRate.toFixed(1)}% of your monthly inflow, outperforming the foundational 20% benchmark.`
      : `You are retaining ${savingsRate.toFixed(1)}% of income this month. Financial independence models require at least 20% to build compounding wealth.`,
    advisorPrescription: r1Status === 'pass'
      ? 'Continue sweeping your surplus into high-yield accounts or diversified index investments.'
      : 'Automate an immediate transfer of 20% of each client invoice or paycheck directly into savings upon arrival.',
    actionUrl: '/reports',
    actionLabel: 'View Cash Flow',
  });

  // ─────────────────────────────────────────────────────────────
  // 2. RULE #2: THE 50/30/20 BUDGET EQUILIBRIUM
  // ─────────────────────────────────────────────────────────────
  const needsNames = ['Groceries', 'Vegetables', 'Meat & Fish', 'Rent', 'Utilities', 'Health', 'Transport', 'Taxes & Fees'];
  const wantsNames = ['Dining', 'Snacks', 'Shopping', 'Subscriptions', 'Education', 'Family', 'Other'];

  let needsSpendUsd = 0;
  let wantsSpendUsd = 0;

  for (const t of thisMonthTx.filter(tx => tx.type === 'expense')) {
    const cat = categories.find(c => c.id === t.categoryId);
    const catName = cat?.name || 'Other';
    const usdAmt = convertToUsd(t.amountMinor, t.currency);
    if (needsNames.includes(catName)) needsSpendUsd += usdAmt;
    else wantsSpendUsd += usdAmt;
  }

  const denominator = Math.max(thisMonthIncomeUsd, needsSpendUsd + wantsSpendUsd, 1);
  const needsPct = (needsSpendUsd / denominator) * 100;
  const wantsPct = (wantsSpendUsd / denominator) * 100;

  let r2Status: RuleStatus = 'pass';
  if (needsPct > 65 || wantsPct > 40) r2Status = 'fail';
  else if (needsPct > 50 || wantsPct > 30) r2Status = 'warning';

  rules.push({
    id: 'rule_50_30_20',
    number: 2,
    name: '50/30/20 Capital Allocation',
    principle: 'Cap essential needs at 50% and discretionary lifestyle wants at 30% of income.',
    benchmark: 'Needs ≤50% · Wants ≤30%',
    currentValueFormatted: `${needsPct.toFixed(0)}% Needs / ${wantsPct.toFixed(0)}% Wants`,
    currentNumericValue: needsPct + wantsPct,
    benchmarkNumericValue: 80,
    unit: '%',
    status: r2Status,
    statusLabel: r2Status === 'pass' ? 'Balanced Allocation' : r2Status === 'warning' ? 'Discretionary Creep' : 'Needs Straining Cash Flow',
    explanation: `Your spending splits into ${needsPct.toFixed(1)}% essential survival needs and ${wantsPct.toFixed(1)}% lifestyle wants.`,
    advisorPrescription: r2Status === 'pass'
      ? 'Your spending structure leaves ample bandwidth for wealth accumulation.'
      : wantsPct > 30
      ? `Audit non-essential categories (Dining, Shopping, Entertainment) to trim ${formatMoney(Math.round((wantsPct - 30) * denominator / 100), 'USD')} this month.`
      : 'Fixed survival expenses are consuming over half your earnings. Focus on expanding high-margin client income.',
    actionUrl: '/reports',
    actionLabel: 'Analyze 50/30/20 Breakdown',
  });

  // ─────────────────────────────────────────────────────────────
  // 3. RULE #3: THE 3-TO-6 MONTH EMERGENCY RUNWAY
  // ─────────────────────────────────────────────────────────────
  const runwayMonths = avgMonthlyBurnUsd > 0 ? totalNetWorthUsd / avgMonthlyBurnUsd : 0;

  let r3Status: RuleStatus = 'fail';
  if (runwayMonths >= 6) r3Status = 'pass';
  else if (runwayMonths >= 3) r3Status = 'warning';

  rules.push({
    id: 'rule_emergency_runway',
    number: 3,
    name: '3-to-6 Month Emergency Runway',
    principle: 'Maintain liquid cash reserves to cover 3 to 6 months of baseline living costs without fresh income.',
    benchmark: '≥ 3.0 to 6.0 Months',
    currentValueFormatted: `${runwayMonths.toFixed(1)} Months`,
    currentNumericValue: runwayMonths,
    benchmarkNumericValue: 3.0,
    unit: 'mo',
    status: r3Status,
    statusLabel: r3Status === 'pass' ? 'Fortress Reserve' : r3Status === 'warning' ? 'Adequate Cushion' : 'Vulnerable to Inflow Shocks',
    explanation: `Your current net worth of ${formatMoney(totalNetWorthUsd, 'USD')} covers ${runwayMonths.toFixed(1)} months at your average monthly burn rate of ${formatMoney(Math.round(avgMonthlyBurnUsd), 'USD')}/mo.`,
    advisorPrescription: r3Status === 'pass'
      ? 'Your safety buffer is robust. You can weather extended client dry spells or medical contingencies without liquidating investments.'
      : r3Status === 'warning'
      ? `Strengthen your reserve by adding ${formatMoney(Math.round((6 - runwayMonths) * avgMonthlyBurnUsd), 'USD')} to achieve the 6-month resilience gold standard.`
      : `Prioritize liquidity immediately. A single delayed invoice or unexpected emergency could trigger financial distress.`,
    actionUrl: '/goals',
    actionLabel: 'Build Emergency Fund',
  });

  // ─────────────────────────────────────────────────────────────
  // 4. RULE #4: THE 5% SUBSCRIPTION OVERHEAD CEILING
  // ─────────────────────────────────────────────────────────────
  let totalSubMonthlyUsd = 0;
  for (const s of subscriptions) {
    const amt = convertToUsd(s.amountMinor, s.currency);
    if (s.billingCycle === 'yearly') totalSubMonthlyUsd += amt / 12;
    else if (s.billingCycle === 'quarterly') totalSubMonthlyUsd += amt / 3;
    else if (s.billingCycle === 'weekly') totalSubMonthlyUsd += amt * 4.33;
    else totalSubMonthlyUsd += amt;
  }

  const subToIncomeRatio = baselineIncomeUsd > 0 ? (totalSubMonthlyUsd / baselineIncomeUsd) * 100 : 0;

  let r4Status: RuleStatus = 'pass';
  if (subToIncomeRatio > 10) r4Status = 'fail';
  else if (subToIncomeRatio > 5) r4Status = 'warning';

  rules.push({
    id: 'rule_subscription_ceiling',
    number: 4,
    name: '5% Subscription Overhead Ceiling',
    principle: 'Software, media, and recurring subscriptions must not exceed 5% of gross monthly income.',
    benchmark: '≤ 5.0% of Income',
    currentValueFormatted: `${subToIncomeRatio.toFixed(1)}% (${formatMoney(Math.round(totalSubMonthlyUsd), 'USD')}/mo)`,
    currentNumericValue: subToIncomeRatio,
    benchmarkNumericValue: 5.0,
    unit: '%',
    status: r4Status,
    statusLabel: r4Status === 'pass' ? 'Lean & Efficient' : r4Status === 'warning' ? 'Approaching Limit' : 'Recurring Bleed',
    explanation: `You have ${subscriptions.length} active recurring commitments totaling ${formatMoney(Math.round(totalSubMonthlyUsd), 'USD')}/month (${subToIncomeRatio.toFixed(1)}% of income).`,
    advisorPrescription: r4Status === 'pass'
      ? 'Subscription overhead is disciplined and leaves your monthly cash flow flexible.'
      : 'Perform a subscription cancellation audit. Eliminate unused tools and switch annual billing for high-value services to capture discounts.',
    actionUrl: '/subscriptions',
    actionLabel: 'Manage Subscriptions',
  });

  // ─────────────────────────────────────────────────────────────
  // 5. RULE #5: SINKING FUND PROACTIVE AMORTIZATION
  // ─────────────────────────────────────────────────────────────
  const totalGoalTargetUsd = goals.reduce((sum, g) => sum + convertToUsd(g.targetMinor, g.currency), 0);
  const totalGoalCurrentUsd = goals.reduce((sum, g) => sum + convertToUsd(g.currentMinor, g.currency), 0);
  const activeGoalsWithDeadlines = goals.filter(g => g.deadline);

  let r5Status: RuleStatus = 'pass';
  if (goals.length === 0) r5Status = 'warning';
  else {
    const fundedRatio = totalGoalTargetUsd > 0 ? (totalGoalCurrentUsd / totalGoalTargetUsd) * 100 : 100;
    if (fundedRatio < 25 && activeGoalsWithDeadlines.length > 0) r5Status = 'warning';
  }

  rules.push({
    id: 'rule_sinking_funds',
    number: 5,
    name: 'Sinking Fund Amortization Rule',
    principle: 'Anticipate non-monthly obligations (equipment upgrades, travel, tax bills) by depositing amortized amounts every month.',
    benchmark: 'Active Sinking Funds for Major Milestones',
    currentValueFormatted: `${goals.length} Goals (${formatMoney(totalGoalCurrentUsd, 'USD')} Saved)`,
    currentNumericValue: goals.length,
    benchmarkNumericValue: 2,
    unit: 'goals',
    status: r5Status,
    statusLabel: r5Status === 'pass' ? 'Proactive Planning' : 'Unplanned Shock Risk',
    explanation: goals.length > 0
      ? `You have ${goals.length} targeted sinking funds with ${formatMoney(totalGoalCurrentUsd, 'USD')} accumulated toward future capital expenditures.`
      : 'No active sinking fund goals configured. Large future purchases will force unexpected cash withdrawals or debt.',
    advisorPrescription: goals.length > 0
      ? 'Maintain monthly contributions to keep all milestone target completion dates on schedule.'
      : 'Set up at least two dedicated sinking fund goals: one for Annual Freelancer Taxes and one for Hardware/Travel Replacement.',
    actionUrl: '/goals',
    actionLabel: 'Configure Sinking Funds',
  });

  // ─────────────────────────────────────────────────────────────
  // 6. RULE #6: FX ARBITRAGE & TRANSACTION FEE MINIMIZATION
  // ─────────────────────────────────────────────────────────────
  let totalTransferVolumeUsd = 0;
  let totalFeeDragUsd = 0;

  for (const tr of transfers) {
    totalTransferVolumeUsd += convertToUsd(tr.amountOutMinor, tr.feeCurrency || 'USD');
    totalFeeDragUsd += convertToUsd(tr.feeMinor, tr.feeCurrency || 'USD');
  }

  const feeDragPercent = totalTransferVolumeUsd > 0 ? (totalFeeDragUsd / totalTransferVolumeUsd) * 100 : 0;

  let r6Status: RuleStatus = 'pass';
  if (feeDragPercent > 2.0) r6Status = 'fail';
  else if (feeDragPercent > 1.0) r6Status = 'warning';

  rules.push({
    id: 'rule_fx_drag',
    number: 6,
    name: 'FX & Transfer Fee Drag (< 1.0%)',
    principle: 'Cross-border conversions and remittances must not lose more than 1.0% to payment processor spreads and fees.',
    benchmark: '≤ 1.0% Fee Drag',
    currentValueFormatted: `${feeDragPercent.toFixed(2)}% Drag (${formatMoney(totalFeeDragUsd, 'USD')} Fees)`,
    currentNumericValue: feeDragPercent,
    benchmarkNumericValue: 1.0,
    unit: '%',
    status: r6Status,
    statusLabel: r6Status === 'pass' ? 'Frictionless Remittance' : r6Status === 'warning' ? 'Moderate Fee Bleed' : 'High Processing Toll',
    explanation: `Across ${transfers.length} inter-account transfers totaling ${formatMoney(totalTransferVolumeUsd, 'USD')}, you have incurred ${formatMoney(totalFeeDragUsd, 'USD')} in intermediary transfer fees (${feeDragPercent.toFixed(2)}%).`,
    advisorPrescription: r6Status === 'pass'
      ? 'Your currency conversion channels are operating at peak efficiency.'
      : 'Batch inter-account transfers into larger monthly sums rather than frequent micro-transfers to minimize fixed gateway fees.',
    actionUrl: '/accounts',
    actionLabel: 'Inspect Account Transfers',
  });

  // ─────────────────────────────────────────────────────────────
  // 7. RULE #7: FIXED COMMITMENTS BURDEN (The 36% Rule)
  // ─────────────────────────────────────────────────────────────
  // Fixed costs = Rent + Utilities + Subscriptions + Health + Fixed Transport
  const fixedNames = ['Rent', 'Utilities', 'Subscriptions', 'Health', 'Transport'];
  let fixedSpendUsd = 0;

  for (const t of thisMonthTx.filter(tx => tx.type === 'expense')) {
    const cat = categories.find(c => c.id === t.categoryId);
    const catName = cat?.name || '';
    if (fixedNames.includes(catName)) {
      fixedSpendUsd += convertToUsd(t.amountMinor, t.currency);
    }
  }

  const fixedCommitmentRatio = baselineIncomeUsd > 0 ? (fixedSpendUsd / baselineIncomeUsd) * 100 : 0;

  let r7Status: RuleStatus = 'pass';
  if (fixedCommitmentRatio > 45) r7Status = 'fail';
  else if (fixedCommitmentRatio > 36) r7Status = 'warning';

  rules.push({
    id: 'rule_fixed_commitments',
    number: 7,
    name: 'The 36% Fixed Commitments Ceiling',
    principle: 'Strict non-negotiable living overheads (rent, bills, utilities) must never exceed 36% of monthly gross inflow.',
    benchmark: '≤ 36.0% Fixed Overhead',
    currentValueFormatted: `${fixedCommitmentRatio.toFixed(1)}% (${formatMoney(fixedSpendUsd, 'USD')})`,
    currentNumericValue: fixedCommitmentRatio,
    benchmarkNumericValue: 36.0,
    unit: '%',
    status: r7Status,
    statusLabel: r7Status === 'pass' ? 'Nimble Cost Base' : r7Status === 'warning' ? 'Tight Overhead' : 'High Structural Vulnerability',
    explanation: `Your fixed non-negotiable overheads consume ${fixedCommitmentRatio.toFixed(1)}% of your monthly cash flow.`,
    advisorPrescription: r7Status === 'pass'
      ? 'Your low fixed overhead provides high operational flexibility during slow income cycles.'
      : 'Avoid taking on new long-term contracts or leases. When fixed commitments exceed 36%, any revenue fluctuation forces painful emergency cuts.',
    actionUrl: '/budgets',
    actionLabel: 'Review Fixed Budgets',
  });

  // ── Composite Score & Letter Grade Computation ──
  const passedCount = rules.filter(r => r.status === 'pass').length;
  const warningCount = rules.filter(r => r.status === 'warning').length;
  const failCount = rules.filter(r => r.status === 'fail').length;

  // Weighted scoring: Pass = 100%, Warning = 60%, Fail = 20%
  const compositeScore = Math.round(
    (passedCount * 100 + warningCount * 60 + failCount * 20) / rules.length
  );

  let letterGrade: GoldenRulesAudit['letterGrade'] = 'B';
  let gradeTitle = 'Solid Financial Foundation';
  let gradeDescription = 'Your money management aligns well with standard golden rules, with minor opportunities for optimization.';

  if (compositeScore >= 92) {
    letterGrade = 'A+';
    gradeTitle = 'Institutional-Grade Financial Discipline';
    gradeDescription = 'Your portfolio adheres strictly to classic wealth preservation and growth rules. Minimal vulnerability detected.';
  } else if (compositeScore >= 82) {
    letterGrade = 'A';
    gradeTitle = 'Strong Wealth-Building Trajectory';
    gradeDescription = 'Most golden rules are comfortably satisfied. High resilience against macroeconomic volatility.';
  } else if (compositeScore >= 70) {
    letterGrade = 'B';
    gradeTitle = 'Balanced with Tactical Gaps';
    gradeDescription = 'Your core habits are solid, but certain thresholds (such as emergency runway or subscription load) require attention.';
  } else if (compositeScore >= 55) {
    letterGrade = 'C';
    gradeTitle = 'Moderate Cash Flow Strain';
    gradeDescription = 'Multiple financial golden rules are currently breached. Focused remediation is recommended to prevent compounding stress.';
  } else {
    letterGrade = 'D';
    gradeTitle = 'High Financial Vulnerability';
    gradeDescription = 'Critical golden rules regarding reserves, fixed overhead, and savings retention are currently unmet.';
  }

  // Key Strengths & Immediate Actions
  const keyStrengths = rules
    .filter(r => r.status === 'pass')
    .map(r => `${r.name}: ${r.statusLabel} (${r.currentValueFormatted})`);

  const immediateActions = rules
    .filter(r => r.status !== 'pass')
    .map(r => `${r.name}: ${r.advisorPrescription}`);

  return {
    compositeScore,
    letterGrade,
    gradeTitle,
    gradeDescription,
    passedCount,
    warningCount,
    failCount,
    rules,
    keyStrengths,
    immediateActions,
  };
}
