'use client';

import { useState, useEffect } from 'react';
import { Target, Plus, CheckCircle, Calendar } from 'lucide-react';
import { store } from '@/lib/store';
import { formatMoney, dateLabel } from '@/lib/finance';
import type { Goal } from '@/types';

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    setGoals(store.getGoals());
  }, []);

  const addContribution = (id: string, amountMinor: number) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    const nextCurrent = Math.min(goal.targetMinor, goal.currentMinor + amountMinor);
    store.updateGoal(id, { currentMinor: nextCurrent });
    setGoals(store.getGoals());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Goals</h1>
          <p className="page-subtitle">Track targets that matter — emergency funds, big equipment, and life milestones</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {goals.map(g => {
          const pct = Math.round((g.currentMinor / Math.max(g.targetMinor, 1)) * 100);
          const isComplete = pct >= 100;

          return (
            <div
              key={g.id}
              className="ember-glass"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{g.name}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      <Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                      Target deadline: {dateLabel(g.deadline)}
                    </p>
                  </div>
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: isComplete ? 'rgba(110,231,168,0.1)' : 'rgba(255,59,31,0.1)',
                      color: isComplete ? 'var(--color-income)' : 'var(--color-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Target size={18} />
                  </span>
                </div>

                <div style={{ margin: '16px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <p className="text-money">{formatMoney(g.currentMinor, g.currency)}</p>
                    <span className="ember-number" style={{ fontSize: '0.875rem', fontWeight: 600 }}>{pct}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: 8 }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: isComplete ? 'var(--color-income)' : 'var(--color-accent)',
                      }}
                    />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                    Target: {formatMoney(g.targetMinor, g.currency)}
                  </p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, display: 'flex', gap: 8 }}>
                {!isComplete ? (
                  <>
                    <button
                      onClick={() => addContribution(g.id, g.currency === 'USD' ? 5000 : 500000)}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                    >
                      + {g.currency === 'USD' ? '$50' : '৳5,000'}
                    </button>
                    <button
                      onClick={() => addContribution(g.id, g.currency === 'USD' ? 20000 : 2000000)}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                    >
                      + {g.currency === 'USD' ? '$200' : '৳20,000'}
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-income)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={16} /> Goal Achieved! 🎉
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
