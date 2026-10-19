'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Header } from './Header';
import { seedData } from '@/data/seed';
import { pullFromCloud } from '@/lib/sync';

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  // Initialize seed data on first client visit and pull latest cloud records
  useEffect(() => {
    seedData();
    pullFromCloud();
  }, []);

  // Global Keyboard shortcut: N to quick add activity
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        (e.key === 'n' || e.key === 'N') &&
        !e.metaKey && !e.ctrlKey && !e.altKey &&
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
        <main style={{ padding: '28px 36px', width: '100%', flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
