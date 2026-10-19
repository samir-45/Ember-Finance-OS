'use client';

import { useRouter } from 'next/navigation';
import { Flame, Plus, Menu, CloudCheck } from 'lucide-react';
import { useSyncStatus, syncNow } from '@/lib/sync';

interface HeaderProps {
  onOpenMobileNav: () => void;
}

export function Header({ onOpenMobileNav }: HeaderProps) {
  const router = useRouter();
  const sync = useSyncStatus();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        height: 'var(--header-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(5,5,5,0.20)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onOpenMobileNav}
          className="btn btn-ghost btn-icon mobile-only"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <span className="mobile-only" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Flame size={18} style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontWeight: 600 }}>Ember</span>
        </span>
        <span className="desktop-only" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          A clearer view of your money
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Real-Time Neon Cloud Sync Status Pill */}
        <button
          onClick={() => syncNow()}
          className="btn btn-ghost btn-sm"
          style={{
            fontSize: '0.75rem',
            padding: '5px 10px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            gap: 6,
            color: sync.state === 'error' ? 'var(--color-critical)' : 'var(--text-secondary)',
          }}
          title={
            sync.lastSyncedAt
              ? `Synced with Neon PostgreSQL at ${sync.lastSyncedAt}`
              : 'Auto-syncing to Neon PostgreSQL'
          }
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor:
                sync.state === 'syncing'
                  ? 'var(--ember-orange)'
                  : sync.state === 'error'
                  ? 'var(--color-critical)'
                  : 'var(--color-income)',
              boxShadow:
                sync.state === 'syncing'
                  ? '0 0 8px var(--ember-orange)'
                  : '0 0 6px rgba(110, 231, 168, 0.6)',
              display: 'inline-block',
            }}
          />
          <span className="desktop-only" style={{ fontSize: '0.6875rem', opacity: 0.85 }}>
            {sync.state === 'syncing' ? 'Syncing...' : sync.state === 'error' ? 'Sync Error' : 'Cloud Synced'}
          </span>
        </button>

        <button
          onClick={() => router.push('/transactions?quickAdd=1')}
          className="btn btn-primary btn-sm"
        >
          <Plus size={16} />
          <span className="desktop-only">Add activity</span>
          <kbd
            className="desktop-only"
            style={{
              padding: '1px 6px',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.2)',
              fontSize: '0.625rem',
              opacity: 0.7,
            }}
          >
            N
          </kbd>
        </button>
      </div>
    </header>
  );
}
