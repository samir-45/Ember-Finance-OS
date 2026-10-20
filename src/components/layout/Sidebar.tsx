'use client';

import { Flame } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './nav-config';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 260,
        flexShrink: 0,
        borderRight: '1px solid var(--border-subtle)',
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100dvh',
        overflowY: 'auto',
      }}
      className="desktop-sidebar"
    >
      {/* Brand */}
      <Link
        href="/dashboard"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textDecoration: 'none',
          color: 'inherit',
          marginBottom: 40,
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255,59,31,0.2)',
            background: 'rgba(255,59,31,0.1)',
            color: 'var(--color-accent)',
          }}
        >
          <Flame size={20} />
        </span>
        <span style={{ fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
          Ember
        </span>
      </Link>

      <span className="label-uppercase" style={{ padding: '0 12px', marginBottom: 12 }}>
        Your workspace
      </span>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              href={to}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                textDecoration: 'none',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(255,59,31,0.08)' : 'transparent',
                transition: 'all 150ms ease',
              }}
            >
              <Icon size={16} style={{ opacity: 0.8 }} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{ marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}
      >
        <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Your private space</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Personal finance workspace
        </p>
      </div>
    </aside>
  );
}
