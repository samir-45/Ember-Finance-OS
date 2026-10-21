'use client';
import { localDate } from '@/lib/dates';
import { downloadFile } from '@/lib/finance';
import { normalizeLedger } from '@/lib/ledger';
import { store } from '@/lib/store';
import {
  getConflictCopy,
  pullFromCloud,
  resolveConflict,
  syncNow,
  useSyncStatus,
} from '@/lib/sync';
import type { LedgerSnapshot } from '@/types';
import { useState } from 'react';
export function DataManagement() {
  const sync = useSyncStatus();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<LedgerSnapshot | null>(null);
  const [remote, setRemote] = useState<{ data: LedgerSnapshot; revision: number } | null>(null);
  const action = async (fn: () => void | Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The operation failed');
    } finally {
      setBusy(false);
    }
  };
  const exportBackup = () =>
    downloadFile(
      JSON.stringify({ ...store.getSnapshot(), exportedAt: new Date().toISOString() }, null, 2),
      `ember-backup-${localDate()}.json`,
      'application/json',
    );
  return (
    <div className="settings-stack">
      <section className="ember-glass settings-card settings-stack">
        <h2>Storage & owner access</h2>
        <p>
          You are signed in as the owner. Each edit saves in this browser immediately and starts a
          server sync in the background. Check the status below and keep independent backups.
        </p>
        <p role="status">
          {store.getLocalState().mode === 'demo'
            ? 'Demo workspace'
            : store.getLocalState().mode === 'browser'
              ? 'Browser only'
              : `Server storage: ${sync.provider ?? 'not connected'}`}{' '}
          · {sync.state}
          {sync.lastSyncedAt ? ` · Saved ${new Date(sync.lastSyncedAt).toLocaleString()}` : ''}
        </p>
        {store.getLocalState().mode === 'demo' && (
          <button
            className="btn btn-primary"
            onClick={() =>
              void action(() => {
                const raw = localStorage.getItem('ember_personal_workspace');
                if (!raw) throw new Error('No saved personal workspace');
                localStorage.setItem('ember_ledger_v2', raw);
                window.location.reload();
              })
            }
          >
            Return to personal workspace
          </button>
        )}
        {sync.error && (
          <p className="form-error" role="alert">
            {sync.error}
          </p>
        )}
        <div className="action-row">
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                store.setMode('cloud');
                await pullFromCloud();
              })
            }
          >
            Load server copy
          </button>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                if (!(await syncNow()))
                  throw new Error('Sync did not complete. Review the status above.');
              })
            }
          >
            Retry sync now
          </button>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                if (
                  store.getLocalState().dirty &&
                  store.getLocalState().mode === 'cloud' &&
                  !confirm('There are unsynced changes. Keep them in this browser and sign out?')
                )
                  return;
                const res = await fetch('/api/auth/session', {
                  method: 'DELETE',
                  signal: AbortSignal.timeout(10000),
                });
                if (!res.ok) throw new Error('Could not sign out of the server. Please retry.');
                // Pause queued uploads and avoid a second unload prompt after the
                // owner has chosen to retain pending edits. Sign-in reconnects them.
                if (store.getLocalState().mode !== 'demo') store.setMode('browser');
                window.location.replace('/login');
              })
            }
          >
            Sign out
          </button>
        </div>
      </section>
      {(sync.state === 'conflict' || remote) && (
        <section className="ember-glass settings-card settings-stack">
          <h2>Review the conflicting copies</h2>
          <p>Neither copy has been overwritten. Download both before selecting the copy to keep.</p>
          <div className="action-row">
            <button className="btn btn-secondary" onClick={exportBackup}>
              Download browser copy
            </button>
            <button
              className="btn btn-secondary"
              onClick={() =>
                void action(async () => {
                  const copy = await getConflictCopy();
                  setRemote(copy);
                  downloadFile(
                    JSON.stringify(copy.data, null, 2),
                    `ember-server-revision-${copy.revision}.json`,
                    'application/json',
                  );
                })
              }
            >
              Review & download server copy
            </button>
          </div>
          {remote && (
            <>
              <p>
                Server revision {remote.revision}: {remote.data.accounts.length} accounts,{' '}
                {remote.data.transactions.length} transactions, {remote.data.transfers.length}{' '}
                transfers. Browser: {store.getAccounts().length} accounts,{' '}
                {store.getTransactions().length} transactions.
              </p>
              <div className="action-row">
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    void action(async () => {
                      if (
                        confirm(
                          'Replace the browser ledger with the reviewed server copy? A local recovery copy is retained.',
                        )
                      ) {
                        await resolveConflict('server');
                        setRemote(null);
                      }
                    })
                  }
                >
                  Keep server copy
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() =>
                    void action(async () => {
                      if (
                        confirm(
                          'Replace the current server ledger with this browser copy? The previous server revision is retained.',
                        )
                      ) {
                        if (!(await resolveConflict('browser')))
                          throw new Error('Server changed again; review the latest copy.');
                        setRemote(null);
                      }
                    })
                  }
                >
                  Keep browser copy on server
                </button>
              </div>
            </>
          )}
        </section>
      )}
      <section className="ember-glass settings-card settings-stack">
        <h2>Backup & restore</h2>
        <p>
          JSON archives contain the complete ledger, allocations, reconciliations, and preferences.
          Export before moving devices or changing storage. Backups contain private financial
          information.
        </p>
        <div className="action-row">
          <button className="btn btn-primary" onClick={exportBackup}>
            Export JSON backup
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              const raw = localStorage.getItem('ember_recovery_v2');
              if (!raw) {
                setError('No previous recovery copy exists yet');
                return;
              }
              const data = JSON.parse(raw);
              downloadFile(
                JSON.stringify(data.ledger, null, 2),
                'ember-previous-recovery.json',
                'application/json',
              );
            }}
          >
            Download previous recovery copy
          </button>
        </div>
        <label htmlFor="restore-file">
          Preview a JSON archive
          <input
            id="restore-file"
            type="file"
            accept="application/json,.json"
            onChange={(e) =>
              void action(async () => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPreview(null);
                if (file.size > 10485760) throw new Error('Archive must be smaller than 10 MB');
                setPreview(normalizeLedger(JSON.parse(await file.text())));
              })
            }
          />
        </label>
        {preview && (
          <div className="form-stack">
            <p>
              Validated archive: {preview.accounts.length} accounts, {preview.transactions.length}{' '}
              transactions, {preview.transfers.length} transfers, {preview.goals.length} goals.
              Restore replaces this browser ledger and queues a cloud save only if connected.
            </p>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={() =>
                void action(() => {
                  if (
                    !confirm(
                      'Replace the active browser ledger with this archive? A recovery copy will be saved first.',
                    )
                  )
                    return;
                  store.importAll(preview);
                  setPreview(null);
                  setMessage('Archive restored. Review account balances before continuing.');
                })
              }
            >
              Restore this archive
            </button>
          </div>
        )}
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
