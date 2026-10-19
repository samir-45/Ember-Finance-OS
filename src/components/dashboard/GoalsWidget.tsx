'use client';

import { useRouter } from 'next/navigation';
import { SectionCard } from './SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatMoney } from '@/lib/finance';
import type { Goal } from '@/types';

interface GoalsWidgetProps {
  goals: Goal[];
}

export function GoalsWidget({ goals }: GoalsWidgetProps) {
  const router = useRouter();

  return (
    <SectionCard
      title="Goals in motion"
      action={
        <button onClick={() => router.push('/goals')} className="btn btn-ghost btn-sm">
          See goals
        </button>
      }
      index={7}
    >
      {goals.length === 0 ? (
        <EmptyState text="Choose something that matters and start moving toward it." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {goals.slice(0, 3).map(goal => {
            const pct = Math.round((goal.currentMinor / Math.max(goal.targetMinor, 1)) * 100);
            return (
              <div key={goal.id}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                    fontSize: '0.875rem',
                  }}
                >
                  <span>{goal.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{pct}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${pct}%`,
                      background:
                        pct >= 75
                          ? 'var(--color-income)'
                          : pct >= 50
                          ? 'var(--color-warning)'
                          : 'var(--color-accent)',
                    }}
                  />
                </div>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {formatMoney(goal.currentMinor, goal.currency)} of {formatMoney(goal.targetMinor, goal.currency)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
