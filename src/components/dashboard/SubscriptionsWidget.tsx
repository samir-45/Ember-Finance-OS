'use client';

import { EmptyState } from '@/components/ui/EmptyState';
import { dateLabel, formatMoney } from '@/lib/finance';
import type { Subscription } from '@/types';
import { Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SectionCard } from './SectionCard';

interface SubscriptionsWidgetProps {
  subscriptions: Subscription[];
}

export function SubscriptionsWidget({ subscriptions }: SubscriptionsWidgetProps) {
  const router = useRouter();
  const activeSubs = subscriptions.filter((s) => s.active);

  return (
    <SectionCard
      title="Coming up"
      action={
        <button onClick={() => router.push('/subscriptions')} className="btn btn-ghost btn-sm">
          Subscriptions
        </button>
      }
      index={6}
    >
      {activeSubs.length === 0 ? (
        <EmptyState text="Recurring charges will appear here." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeSubs.slice(0, 4).map((sub) => (
            <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.875rem' }}>{sub.name}</p>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  <Clock
                    size={10}
                    style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}
                  />
                  {dateLabel(sub.nextBillingDate)}
                </p>
              </div>
              <span className="text-money-sm">{formatMoney(sub.amountMinor, sub.currency)}</span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
