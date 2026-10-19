'use client';

import { useState, useEffect } from 'react';
import { Repeat2, Clock, CheckCircle2, PauseCircle, Calendar } from 'lucide-react';
import { store } from '@/lib/store';
import { formatMoney, dateLabel, convertToUsd } from '@/lib/finance';
import type { Subscription } from '@/types';

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  useEffect(() => {
    setSubscriptions(store.getSubscriptions());
  }, []);

  const totalMonthlyUsd = subscriptions
    .filter(s => s.active)
    .reduce((sum, s) => {
      const perMonth = s.billingCycle === 'yearly' ? s.amountMinor / 12 : s.amountMinor;
      return sum + convertToUsd(perMonth, s.currency);
    }, 0);

  const toggleSubscription = (id: string) => {
    const sub = subscriptions.find(s => s.id === id);
    if (!sub) return;
    store.updateSubscription(id, { active: !sub.active });
    setSubscriptions(store.getSubscriptions());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Subscriptions & Recurring</h1>
          <p className="page-subtitle">Manage fixed recurring software licenses, streaming, and services</p>
        </div>
      </div>

      {/* Overview Card */}
      <div className="ember-glass" style={{ padding: '24px 28px' }}>
        <span className="label-uppercase">Monthly Commitment</span>
        <p className="text-money" style={{ marginTop: 8 }}>
          {formatMoney(totalMonthlyUsd, 'USD')}/mo
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
          Across {subscriptions.filter(s => s.active).length} active subscriptions
        </p>
      </div>

      {/* Subscriptions Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {subscriptions.map(s => (
          <div
            key={s.id}
            className="ember-glass"
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              opacity: s.active ? 1 : 0.6,
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{s.name}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {s.billingCycle} billing
                  </p>
                </div>
                <button
                  onClick={() => toggleSubscription(s.id)}
                  className={`btn btn-sm ${s.active ? 'btn-ghost' : 'btn-secondary'}`}
                  style={{ padding: '4px 8px' }}
                >
                  {s.active ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-income)' }}>
                      <CheckCircle2 size={14} /> Active
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                      <PauseCircle size={14} /> Paused
                    </span>
                  )}
                </button>
              </div>

              <div style={{ margin: '16px 0' }}>
                <p className="text-money">{formatMoney(s.amountMinor, s.currency)}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  <Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                  Next billing: {dateLabel(s.nextBillingDate)}
                </p>
              </div>
            </div>

            <div
              style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 12,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              <span>{s.currency} currency</span>
              <span>{s.billingCycle}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
