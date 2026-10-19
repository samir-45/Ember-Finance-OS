'use client';

import { useRouter } from 'next/navigation';
import { SectionCard } from './SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatMoney } from '@/lib/finance';
import type { AccountBalance } from '@/types';

interface AccountsWidgetProps {
  accounts: AccountBalance[];
}

export function AccountsWidget({ accounts }: AccountsWidgetProps) {
  const router = useRouter();

  return (
    <SectionCard
      title="Your accounts"
      action={
        <button onClick={() => router.push('/accounts')} className="btn btn-ghost btn-sm">
          Manage
        </button>
      }
      index={5}
    >
      {accounts.length === 0 ? (
        <EmptyState text="Add your first account." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {accounts.slice(0, 5).map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }} />
                <div>
                  <p style={{ fontSize: '0.875rem' }}>{a.name}</p>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {a.type} · {a.currency}
                  </p>
                </div>
              </div>
              <span className="text-money-sm">{formatMoney(a.balanceMinor, a.currency)}</span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
