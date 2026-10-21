'use client';
import { Flame, Menu, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
export function Header({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const router = useRouter();
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
