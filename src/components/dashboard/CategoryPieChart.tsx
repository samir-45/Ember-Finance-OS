'use client';

import { EmptyState } from '@/components/ui/EmptyState';
import { formatMoney } from '@/lib/finance';
import type { CategorySpending, Currency } from '@/types';
import { useRouter } from 'next/navigation';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { SectionCard } from './SectionCard';

interface CategoryPieChartProps {
  categorySpending: CategorySpending[];
  currency: Currency;
}

export function CategoryPieChart({ categorySpending, currency }: CategoryPieChartProps) {
  const router = useRouter();

  const pieData = categorySpending.map((c) => ({
    name: c.categoryName,
    value: (currency === 'USD' ? c.amounts.usdMinor : c.amounts.bdtMinor) / 100,
    color: c.color,
  }));

  return (
    <SectionCard
      title="Where it went"
      action={<span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>This month</span>}
      index={3}
    >
      {categorySpending.length === 0 ? (
        <EmptyState text="Categories will appear as you add expenses." />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
          <div style={{ width: 140, height: 140, flexShrink: 0 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={pieData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div
            style={{
              flex: '1 1 180px',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {categorySpending.slice(0, 6).map((cat) => (
              <button
                key={cat.categoryId}
                onClick={() => router.push(`/transactions?categoryId=${cat.categoryId}`)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  textAlign: 'left',
                  padding: 0,
                  width: '100%',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                    fontSize: '0.8125rem',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }}
                    />
                    {cat.categoryName}
                  </span>
                  <span className="ember-number" style={{ color: 'var(--text-muted)' }}>
                    {formatMoney(
                      currency === 'USD' ? cat.amounts.usdMinor : cat.amounts.bdtMinor,
                      currency,
                    )}
                    <span style={{ marginLeft: 4, fontSize: '0.6875rem' }}>
                      · {cat.percentage.toFixed(0)}%
                    </span>
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${cat.percentage}%`, background: cat.color }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
