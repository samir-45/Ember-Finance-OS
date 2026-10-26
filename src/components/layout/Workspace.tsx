'use client';
import { getSyncStatus, hasUnsavedChanges, loadFromServer } from '@/lib/sync';
import { useLedgerVersion } from '@/lib/use-ledger';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MotionConfig } from 'framer-motion';
import { WorkspaceOpening } from './WorkspaceOpening';

// Pages open only after the ledger has been read from the database, so nothing
// stale or empty is ever shown in its place.
export function Workspace({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState('');
  useEffect(() => {
    let disposed = false;
    loadFromServer()
      .then(() => {
        if (!disposed) setReady(true);
      })
      .catch((e: unknown) => {
        if (!disposed)
          setStartupError(e instanceof Error ? e.message : 'Could not load your records.');
      });
    return () => {
      disposed = true;
    };
  }, []);
  if (startupError && !ready)
    return (
      <main className="recovery-screen">
        <h1>Could not load your records</h1>
        <p role="alert">{startupError}</p>
        <p>Nothing has been changed. Try again once the database is reachable.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    );
  if (!ready) return <WorkspaceOpening />;
  return (
    <MotionConfig reducedMotion="user">
      <ActiveWorkspace>{children}</ActiveWorkspace>
    </MotionConfig>
  );
}
function ActiveWorkspace({ children }: { children: ReactNode }) {
  useLedgerVersion();
  const [error, setError] = useState('');
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      setError(
        event.error instanceof Error
          ? event.error.message
          : 'The action could not be completed. Your form is still open.',
      );
    };
    window.addEventListener('error', handler);
    const pending = (event: PromiseRejectionEvent) =>
      setError(
        event.reason instanceof Error
          ? event.reason.message
          : 'The action failed. Please try again.',
      );
    window.addEventListener('unhandledrejection', pending);
    const unload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    // Coming back to the tab shows what the database holds now (e.g. edits from a phone).
    const refresh = () => {
      if (document.visibilityState !== 'visible' || hasUnsavedChanges()) return;
      if (getSyncStatus().state === 'signed-out') return;
      void loadFromServer().catch(() => {
        // The status banner explains that the database could not be reached.
      });
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('error', handler);
      window.removeEventListener('unhandledrejection', pending);
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return (
    <>
      {error &&
        createPortal(
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button onClick={() => setError('')} aria-label="Dismiss error">
              ×
            </button>
          </div>,
          document.body,
        )}
      {children}
    </>
  );
}
