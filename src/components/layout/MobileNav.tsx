'use client';
import { Dialog } from '@/components/ui/Dialog';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './nav-config';
export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  return open ? (
    <Dialog title="Your workspace" onClose={onClose} variant="drawer">
      <nav className="mobile-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            href={to}
            aria-current={path === to ? 'page' : undefined}
            onClick={onClose}
          >
            <Icon size={20} />
            {label}
          </Link>
        ))}
      </nav>
    </Dialog>
  ) : null;
}
