'use client';
import { store } from '@/lib/store';
import { LogOut } from 'lucide-react';
import { useState } from 'react';

export function OwnerSignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const signOut = async () => {
    if (busy) return;
    if (
      store.getLocalState().dirty &&
      store.getLocalState().mode === 'cloud' &&
      !window.confirm('There are unsynced changes. Keep them in this browser and sign out?')
    )
      return;

    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/session', {
        method: 'DELETE',
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Could not sign out. Please retry.');
      if (store.getLocalState().mode !== 'demo') store.setMode('browser');
      window.location.replace('/login');
    } catch {
      setBusy(false);
      setError('Sign out failed. Retry.');
    }
  };

  return (
    <>
      <button
        className="btn btn-secondary header-sign-out"
        type="button"
        aria-label="Sign out"
        title={error || 'Sign out'}
        disabled={busy}
        onClick={() => void signOut()}
      >
        <LogOut size={17} aria-hidden="true" />
        <span className="desktop-only">
          {busy ? 'Signing out…' : error ? 'Retry sign out' : 'Sign out'}
        </span>
      </button>
      {error && (
        <span className="sr-only" role="status">
          {error}
        </span>
      )}
    </>
  );
}
