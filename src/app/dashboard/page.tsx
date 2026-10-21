'use client';
import { runRulesEngine } from '@/lib/rules-engine';
import { store } from '@/lib/store';
import { useLedgerVersion } from '@/lib/use-ledger';
import Link from 'next/link';

import { computeDashboard, formatMoney, shortMonth } from '@/lib/finance';
import { useBackground } from '@/lib/background';
import type { Currency, DashboardData } from '@/types';
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

// Modular Dashboard Widgets
import { AccountsWidget } from '@/components/dashboard/AccountsWidget';
import { CashFlowChart } from '@/components/dashboard/CashFlowChart';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { CoachInsightsWidget } from '@/components/dashboard/CoachInsightsWidget';
import { CurrencyClarityWidget } from '@/components/dashboard/CurrencyClarityWidget';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { GoalsWidget } from '@/components/dashboard/GoalsWidget';
import { HealthRing } from '@/components/dashboard/HealthRing';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { RecentActivityWidget } from '@/components/dashboard/RecentActivityWidget';
import { SectionCard } from '@/components/dashboard/SectionCard';
import { SubscriptionsWidget } from '@/components/dashboard/SubscriptionsWidget';

export default function DashboardPage() {
  const ledgerVersion = useLedgerVersion();
  const [background] = useBackground();
  const [currency, setCurrency] = useState<Currency>(() => store.getSettings().baseCurrency);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    setData({ ...computeDashboard(), coachInsights: runRulesEngine() });
  }, [ledgerVersion]);

  if (!data) return <DashboardSkeleton />;

  const val = (pair: { usdMinor: number; bdtMinor: number }) =>
    formatMoney(currency === 'USD' ? pair.usdMinor : pair.bdtMinor, currency);

  // Cash flow chart data formatted for Recharts
  const cashFlowData = data.cashFlow.map((p) => ({
    month: shortMonth(p.month),
    income: (currency === 'USD' ? p.income.usdMinor : p.income.bdtMinor) / 100,
    expenses: (currency === 'USD' ? p.expenses.usdMinor : p.expenses.bdtMinor) / 100,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div
        className={`dashboard-intro ${background.presetId === 'tudsa' || (background.presetId === 'custom' && !background.customImageDataUrl) ? 'dashboard-intro--light' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <p
            className="label-uppercase"
            style={{ fontSize: '1.25rem', marginBottom: 12, fontWeight: 400, letterSpacing: '0.12em' }}
          >
            {new Intl.DateTimeFormat('en', {
              timeZone: 'Asia/Dhaka',
              month: 'long',
              year: 'numeric',
            }).format(new Date())}
          </p>
          <h1 className="page-title">Your money, in focus</h1>
        </div>
        <div className="tab-bar">
          {(['BDT', 'USD'] as const).map((c) => (
            <button
              key={c}
              className={`tab-item ${currency === c ? 'active' : ''}`}
              aria-pressed={currency === c}
              onClick={() => setCurrency(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: 12,
        }}
      >
        <MetricCard
          index={0}
          label="Available to spend locally"
          value={formatMoney(data.availableBdtMinor, 'BDT')}
          hint="After funded goals, reserves, and bills due this month"
        />
        <MetricCard
          index={1}
          label="Income this month"
          value={val(data.incomeThisMonth)}
          tone="income"
          hint="Earned across your work"
        />
        <MetricCard
          index={2}
          label="Spent this month"
          value={val(data.expensesThisMonth)}
          tone="expense"
          hint={`Savings rate ${data.savingsRatePercent.toFixed(0)}%`}
        />
        <MetricCard
          index={3}
          label="Runway"
          value={
            data.hasExpenseHistory ? `${data.runwayMonths.toFixed(1)} mo` : 'Not enough history'
          }
          hint={
            data.hasExpenseHistory
              ? `Health score: ${data.healthScore}/100`
              : 'Add a complete month of expenses'
          }
        />
      </div>

      <section className="ember-glass settings-card settings-stack">
        <div className="report-buckets">
          <div>
            <p>Giving reserved</p>
            <strong>{formatMoney(data.givingReservedBdtMinor, 'BDT')}</strong>
          </div>
          <div>
            <p>Giving paid this month</p>
            <strong>{formatMoney(data.givingPaidBdtMinor, 'BDT')}</strong>
          </div>
          <div>
            <p>Bills due this month</p>
            <strong>{formatMoney(data.billsDueBdtMinor, 'BDT')}</strong>
          </div>
          <div>
            <p>Current portfolio estimate</p>
            <strong>{val(data.netWorth)}</strong>
          </div>
        </div>
        <p className="page-subtitle">
          Local available money excludes funded goals, earmarked reserves, and uncovered bills due
          this month. USD funds remain in their accounts until converted. Reference estimates are
          not bank quotes.
        </p>
        <div className="action-row">
          <Link className="btn btn-secondary" href="/allocations">
            Allocate income or record giving
          </Link>
          <Link className="btn btn-secondary" href="/accounts">
            Review NSave & bank balances
          </Link>
        </div>
      </section>
      {/* Cash Flow + Money Health & Currency Clarity */}
      <div
        className="dashboard-main-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        <CashFlowChart data={cashFlowData} currency={currency} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard
            title="Money Health"
            action={<Sparkles size={16} style={{ color: 'var(--color-accent)' }} />}
            index={1}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <HealthRing score={data.healthScore} available={data.hasExpenseHistory} />
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>
                  {!data.hasExpenseHistory
                    ? 'Building your baseline'
                    : data.healthScore >= 75
                      ? 'Looking strong'
                      : data.healthScore >= 50
                        ? 'Room to improve'
                        : 'Needs attention'}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Based on savings rate, budget adherence, emergency fund, and subscription load.
                </p>
              </div>
            </div>
          </SectionCard>

          <CurrencyClarityWidget conversionRate={data.conversionRate} />
        </div>
      </div>

      {/* Category Breakdown + Coach Insights */}
      <div
        className="dashboard-two-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}
      >
        <CategoryPieChart categorySpending={data.categorySpending} currency={currency} />
        <CoachInsightsWidget insights={data.coachInsights} />
      </div>

      {/* Accounts + Subscriptions + Goals */}
      <div
        className="dashboard-three-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}
      >
        <AccountsWidget accounts={data.accounts} />
        <SubscriptionsWidget subscriptions={data.subscriptions} />
        <GoalsWidget goals={data.goals} />
      </div>

      {/* Recent Activity */}
      <RecentActivityWidget transactions={data.recentTransactions} />
    </div>
  );
}
