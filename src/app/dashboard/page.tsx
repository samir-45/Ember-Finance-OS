'use client';

import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { computeDashboard, formatMoney, shortMonth } from '@/lib/finance';
import type { Currency, DashboardData } from '@/types';

// Modular Dashboard Widgets
import { MetricCard } from '@/components/dashboard/MetricCard';
import { CashFlowChart } from '@/components/dashboard/CashFlowChart';
import { SectionCard } from '@/components/dashboard/SectionCard';
import { HealthRing } from '@/components/dashboard/HealthRing';
import { CurrencyClarityWidget } from '@/components/dashboard/CurrencyClarityWidget';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { CoachInsightsWidget } from '@/components/dashboard/CoachInsightsWidget';
import { AccountsWidget } from '@/components/dashboard/AccountsWidget';
import { SubscriptionsWidget } from '@/components/dashboard/SubscriptionsWidget';
import { GoalsWidget } from '@/components/dashboard/GoalsWidget';
import { RecentActivityWidget } from '@/components/dashboard/RecentActivityWidget';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { PageGuide } from '@/components/ui/PageGuide';

export default function DashboardPage() {
  const [currency, setCurrency] = useState<Currency>('BDT');
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    setData(computeDashboard());
  }, []);

  if (!data) return <DashboardSkeleton />;

  const val = (pair: { usdMinor: number; bdtMinor: number }) =>
    formatMoney(currency === 'USD' ? pair.usdMinor : pair.bdtMinor, currency);

  // Cash flow chart data formatted for Recharts
  const cashFlowData = data.cashFlow.map(p => ({
    month: shortMonth(p.month),
    income: (currency === 'USD' ? p.income.usdMinor : p.income.bdtMinor) / 100,
    expenses: (currency === 'USD' ? p.expenses.usdMinor : p.expenses.bdtMinor) / 100,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p className="label-uppercase" suppressHydrationWarning style={{ marginBottom: 8 }}>
            {new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date())}
          </p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
            Your money, in focus
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            A calm overview of what came in, what went out, and what you're building.
          </p>
        </div>
        <div className="tab-bar">
          {(['BDT', 'USD'] as const).map(c => (
            <button
              key={c}
              className={`tab-item ${currency === c ? 'active' : ''}`}
              onClick={() => setCurrency(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard Guide */}
      <PageGuide
        pageTitle="Dashboard"
        tagline="Understand your consolidated financial position across foreign earnings and local spending."
        steps={[
          {
            title: 'Review High-Level Metrics',
            description: 'Check your consolidated Net Worth, current monthly Inflow, Outflow, and Runway months at a glance.',
          },
          {
            title: 'Inspect Cash Flow Trajectory',
            description: 'The 6-month area chart visualizes seasonal spikes, income volatility, and surplus patterns.',
          },
          {
            title: 'Track Health Score & Breakdown',
            description: 'The circular Money Health score dynamically scores savings rate, emergency reserve, and subscription overhead.',
          },
          {
            title: 'Monitor Recurring & Targets',
            description: 'Upcoming subscriptions and ongoing milestones are surfaced below with progress bars.',
          },
        ]}
        concept={{
          name: 'Runway Estimation',
          explanation: 'Calculated as (Total Liquid Net Worth ÷ 3-Month Average Burn Rate). An emergency runway of 3 to 6 months provides resilience against income gaps.',
        }}
        proTip="Use the BDT / USD toggle in the top right to instantly flip the entire dashboard between domestic currency and international billing currency."
      />

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <MetricCard
          index={0}
          label="Net worth"
          value={val(data.netWorth)}
          hint={`Across ${data.accounts.length} accounts`}
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
          value={`${data.runwayMonths.toFixed(1)} mo`}
          hint={`Health score: ${data.healthScore}/100`}
        />
      </div>

      {/* Cash Flow + Money Health & Currency Clarity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'stretch' }}>
        <CashFlowChart data={cashFlowData} currency={currency} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard
            title="Money Health"
            action={<Sparkles size={16} style={{ color: 'var(--color-accent)' }} />}
            index={1}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <HealthRing score={data.healthScore} />
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>
                  {data.healthScore >= 75 ? 'Looking strong' : data.healthScore >= 50 ? 'Room to improve' : 'Needs attention'}
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <CategoryPieChart categorySpending={data.categorySpending} currency={currency} />
        <CoachInsightsWidget insights={data.coachInsights} />
      </div>

      {/* Accounts + Subscriptions + Goals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <AccountsWidget accounts={data.accounts} />
        <SubscriptionsWidget subscriptions={data.subscriptions} />
        <GoalsWidget goals={data.goals} />
      </div>

      {/* Recent Activity */}
      <RecentActivityWidget transactions={data.recentTransactions} />
    </div>
  );
}
