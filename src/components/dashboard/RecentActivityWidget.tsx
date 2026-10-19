'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatMoney, dateLabel } from '@/lib/finance';
import type { DashboardData } from '@/types';

interface RecentActivityWidgetProps {
  transactions: DashboardData['recentTransactions'];
}

export function RecentActivityWidget({ transactions }: RecentActivityWidgetProps) {
  const router = useRouter();

  return (
    <SectionCard
      title="Recent activity"
      action={
        <button onClick={() => router.push('/transactions')} className="btn btn-ghost btn-sm">
          All activity <ArrowRight size={12} />
        </button>
      }
      index={8}
    >
      {transactions.length === 0 ? (
        <EmptyState text="Your latest income and spending will show here." />
      ) : (
        <div>
          {transactions.slice(0, 8).map((tx, i) => (
            <div
              key={tx.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: i < 7 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  {tx.merchant || tx.note || tx.categoryName || 'Transaction'}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>{tx.categoryName}</span>
                  <span>·</span>
                  <span>{dateLabel(tx.date)}</span>
                  <span className={`badge badge-${tx.status}`}>{tx.status}</span>
                </div>
              </div>
              <span
                className="ember-number"
                style={{
                  fontSize: '0.875rem',
                  color: tx.type === 'income' ? 'var(--color-income)' : 'var(--text-primary)',
                }}
              >
                {tx.type === 'income' ? '+' : '−'}
                {formatMoney(tx.amountMinor, tx.currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
