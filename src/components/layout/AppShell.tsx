'use client';

import { store } from '@/lib/store';
import { localDate } from '@/lib/dates';
import { pullFromCloud } from '@/lib/sync';
import { useLedgerVersion } from '@/lib/use-ledger';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  useLedgerVersion();
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const ledger = store.getSnapshot();
  const futurePostings = [...ledger.transactions, ...ledger.transfers].filter(
    (entry) => (entry.status ?? 'done') === 'done' && entry.date > localDate(),
  ).length;

  // Pull only for an explicitly connected personal workspace.
  useEffect(() => {
    if (store.getLocalState().mode === 'cloud') void pullFromCloud();
  }, []);

  // Global Keyboard shortcut: N to quick add activity
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        (e.key === 'n' || e.key === 'N') &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !target.isContentEditable &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      ) {
        e.preventDefault();
        router.push('/transactions?quickAdd=1');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router]);

  return (
    <div
      className={store.getSettings().compactMode ? 'compact' : ''}
      style={{
        position: 'relative',
        zIndex: 1,
        minHeight: '100dvh',
        display: 'flex',
        width: '100%',
      }}
    >
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Drawer */}
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main Content Area */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Header onOpenMobileNav={() => setMobileOpen(true)} />
        <main id="workspace-content" className="workspace-main" style={{ width: '100%', flex: 1 }}>
          {futurePostings > 0 && (
            <aside className="ember-glass settings-card" role="status" style={{ marginBottom: 24 }}>
              {futurePostings} future-dated {futurePostings === 1 ? 'record is' : 'records are'}{' '}
              marked done. Original dates and statuses are preserved. These entries are excluded
              from balances and spending until their dates. Review them in{' '}
              <a href="/transactions">Transactions</a> or{' '}
              <a href="/accounts">Accounts &amp; transfers</a> to correct their dates or mark them
              pending.
            </aside>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
