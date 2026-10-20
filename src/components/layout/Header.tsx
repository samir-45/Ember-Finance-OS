'use client';
import { store } from '@/lib/store';
import { useSyncStatus } from '@/lib/sync';
import { useLedgerVersion } from '@/lib/use-ledger';
import { Flame, Menu, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
export function Header({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  useLedgerVersion();
  const router = useRouter();
  const sync = useSyncStatus();
  const state = store.getLocalState();
  const label =
    state.mode === 'demo'
      ? 'Demo · not synced'
      : state.mode === 'browser'
        ? 'Browser only'
        : sync.state === 'synced' && !state.dirty
          ? `Saved to ${sync.provider === 'file' ? 'file vault' : 'PostgreSQL'}`
          : sync.state === 'syncing'
            ? 'Saving…'
            : sync.state === 'conflict'
              ? 'Review conflict'
              : sync.state === 'signed-out'
                ? 'Sign in to sync'
                : state.dirty
                  ? 'Changes pending'
                  : 'Server not connected';
  return (
    <header className="workspace-header">
      <div className="action-row">
        <button
          className="btn btn-ghost btn-icon mobile-only"
          aria-label="Open navigation"
          onClick={onOpenMobileNav}
        >
          <Menu size={20} />
        </button>
        <span className="mobile-only">
          <Flame size={20} aria-hidden="true" /> Ember
        </span>
        <span className="desktop-only">Your earnings, commitments, and everyday money</span>
      </div>
      <div className="action-row">
        <button
          className="btn btn-secondary"
          aria-label={`Storage: ${label}. Open storage settings`}
          onClick={() => router.push('/settings')}
        >
          <span aria-hidden="true">●</span>
          <span className="desktop-only">{label}</span>
        </button>
        <button
          className="btn btn-primary"
          aria-label="Add activity"
          onClick={() => router.push('/transactions?quickAdd=1')}
        >
          <Plus size={18} />
          <span className="desktop-only">Add activity</span>
        </button>
      </div>
    </header>
  );
}
