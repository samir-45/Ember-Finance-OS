'use client';

import { useState, useEffect } from 'react';
import { BarChart3, AlertCircle } from 'lucide-react';
import { store } from '@/lib/store';
import { formatMoney } from '@/lib/finance';
import type { Budget, Category, Transaction } from '@/types';

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    setBudgets(store.getBudgets());
    setCategories(store.getCategories());
    setTransactions(store.getTransactions());
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Monthly Budgets</h1>
          <p className="page-subtitle">Set monthly guardrails for key expense categories to protect your savings rate</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {budgets.map(b => {
          const cat = categories.find(c => c.id === b.categoryId);
          const spentThisMonth = transactions
            .filter(t => t.date.startsWith(currentMonth) && t.categoryId === b.categoryId && t.type === 'expense')
            .reduce((sum, t) => sum + t.amountMinor, 0);

          const pct = Math.round((spentThisMonth / Math.max(b.limitMinor, 1)) * 100);
          const isOver = pct > 100;
          const isWarning = pct > 80 && !isOver;

          return (
            <div key={b.id} className="ember-glass" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: cat?.color || '#fff' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{cat?.name || 'Category'}</h3>
                </div>
                <span
                  className="ember-number"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: isOver ? 'var(--color-critical)' : isWarning ? 'var(--color-warning)' : 'var(--text-muted)',
                  }}
                >
                  {pct}%
                </span>
              </div>

              <div className="progress-bar" style={{ height: 8, margin: '14px 0' }}>
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    background: isOver ? 'var(--color-critical)' : isWarning ? 'var(--color-warning)' : cat?.color || 'var(--color-accent)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginTop: 8 }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Spent: <strong style={{ color: 'var(--text-primary)' }}>{formatMoney(spentThisMonth, b.currency)}</strong>
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Limit: {formatMoney(b.limitMinor, b.currency)}
                </span>
              </div>

              {isOver && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, color: 'var(--color-critical)', fontSize: '0.75rem' }}>
                  <AlertCircle size={14} />
                  <span>Exceeded budget by {formatMoney(spentThisMonth - b.limitMinor, b.currency)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
