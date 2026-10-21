'use client';
import { downloadFile } from '@/lib/finance';
import { store } from '@/lib/store';
import { getSyncStatus, pullFromCloud, triggerAutoSync } from '@/lib/sync';
import { emptyLedger } from '@/lib/ledger';
import { applyWorkspaceReset } from '@/lib/workspace-reset';
import { useLedgerVersion } from '@/lib/use-ledger';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MotionConfig } from 'framer-motion';
import { WorkspaceOpening } from './WorkspaceOpening';

// A consistent hydration gate prevents browser data from differing from SSR HTML.
export function Workspace({
  children,
  resetGeneration,
}: {
  children: ReactNode;
  resetGeneration: unknown;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [startupError, setStartupError] = useState('');
  const [hasBrowserCopy, setHasBrowserCopy] = useState(false);
  useEffect(() => {
    let disposed = false;
    if (!navigator.locks) {
      setLocked(true);
      setError('Safe editing requires a modern browser with Web Locks on HTTPS or localhost.');
      return;
    }
    const controller = new AbortController();
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Queue instead of failing immediately: Strict Mode and hot reload can briefly
    // overlap effect lifetimes while the previous lock is being released.
    const waiting = window.setTimeout(() => {
      if (disposed) return;
      setLocked(true);
      setError(
        'This workspace is open in another tab. Close that tab; this workspace will open automatically when editing is available.',
      );
    }, 250);
    void navigator.locks
      .request('ember-workspace-editor', { signal: controller.signal }, async () => {
        window.clearTimeout(waiting);
        if (disposed) return;
        setLocked(false);
        setError('');
        try {
          if (disposed) return;
          applyWorkspaceReset(resetGeneration);
          store.initialize();
          if (store.getLocalState().mode !== 'demo') {
            store.setMode('cloud');
            const loaded = await pullFromCloud();
            if (disposed) return;
            if (!loaded && getSyncStatus().state !== 'conflict') {
              const local = store.getLocalState();
              setHasBrowserCopy(
                local.dirty || JSON.stringify(local.ledger) !== JSON.stringify(emptyLedger()),
              );
              setStartupError(
                getSyncStatus().error || 'Could not load the latest server copy. Try again.',
              );
              return;
            }
          }
          if (disposed) return;
          setReady(true);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Cannot load saved records');
        }
        await released;
      })
      .catch((e: unknown) => {
        window.clearTimeout(waiting);
        if (disposed || controller.signal.aborted) return;
        setLocked(true);
        setError(e instanceof Error ? e.message : 'Cannot acquire safe editing access');
      });
    return () => {
      disposed = true;
      window.clearTimeout(waiting);
      controller.abort();
      release();
    };
  }, [resetGeneration]);
  if (locked)
    return (
      <main className="recovery-screen">
        <h1>Workspace editing is paused</h1>
        <p role="status">{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    );
  if (error)
    return (
      <main className="recovery-screen">
        <h1>Your saved records need attention</h1>
        <p role="alert">{error}</p>
        <p>
          Your existing storage has been preserved. Download it before repairing or restoring an
          archive.
        </p>
        <button
          className="btn btn-primary"
          onClick={() =>
            downloadFile(
              JSON.stringify(store.getRecoveryRaw(), null, 2),
              'ember-recovery.json',
              'application/json',
            )
          }
        >
          Download recovery copy
        </button>
        <p>
          Use a validated Ember archive to restore this browser after correcting the records. No
          cloud upload has been attempted.
        </p>
        <RecoveryRestore
          onRestored={() => {
            setError('');
            setReady(true);
          }}
        />
      </main>
    );
  if (startupError && !ready)
    return (
      <main className="recovery-screen">
        <h1>Could not load your latest records</h1>
        <p role="alert">{startupError}</p>
        <p>Your browser copy is preserved. The workspace has not opened with an empty ledger.</p>
        <div className="action-row">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Try again
          </button>
          {hasBrowserCopy && (
            <button className="btn btn-secondary" onClick={() => setReady(true)}>
              Open saved browser copy
            </button>
          )}
        </div>
      </main>
    );
  if (!ready) return <WorkspaceOpening />;
  return (
    <MotionConfig reducedMotion="user">
      <ActiveWorkspace>{children}</ActiveWorkspace>
    </MotionConfig>
  );
}
function RecoveryRestore({ onRestored }: { onRestored: () => void }) {
  const [error, setError] = useState('');
  return (
    <div>
      <label htmlFor="recovery-restore">Restore a corrected Ember archive</label>
      <input
        id="recovery-restore"
        type="file"
        accept="application/json,.json"
        onChange={async (e) => {
          try {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 10485760) throw new Error('Archive exceeds 10 MB');
            const { normalizeLedger } = await import('@/lib/ledger');
            const ledger = normalizeLedger(JSON.parse(await file.text()));
            if (
              !confirm(
                'Replace the active browser ledger with this validated archive? Download your recovery copy first.',
              )
            )
              return;
            localStorage.setItem(
              'ember_ledger_v2',
              JSON.stringify({
                ledger,
                revision: 1,
                cloudRevision: null,
                dirty: true,
                mode: 'browser',
              }),
            );
            onRestored();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Restore failed');
          }
        }}
      />
      {error && <p role="alert">{error}</p>}
    </div>
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
      const state = store.getLocalState();
      if (state.mode === 'cloud' && state.dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    const retryPending = () => {
      const state = store.getLocalState();
      const sync = getSyncStatus();
      if (
        state.mode === 'cloud' &&
        state.dirty &&
        sync.state !== 'conflict' &&
        sync.state !== 'signed-out'
      )
        triggerAutoSync();
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('online', retryPending);
    window.addEventListener('focus', retryPending);
    return () => {
      window.removeEventListener('error', handler);
      window.removeEventListener('unhandledrejection', pending);
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener('online', retryPending);
      window.removeEventListener('focus', retryPending);
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
