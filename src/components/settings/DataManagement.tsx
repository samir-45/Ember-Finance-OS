'use client';
import { localDate } from '@/lib/dates';
import { downloadFile } from '@/lib/finance';
import { normalizeLedger } from '@/lib/ledger';
import { store } from '@/lib/store';
import {
  discardUnsavedChanges,
  hasUnsavedChanges,
  loadFromServer,
  saveNow,
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
  const statusText =
    sync.state === 'saving'
      ? 'Saving…'
      : sync.state === 'loading'
        ? 'Loading…'
        : sync.state === 'error'
          ? 'Not saved'
          : 'Saved to the database';
  return (
    <div className="settings-stack">
      <section className="ember-glass settings-card settings-stack">
        <h2>Your data</h2>
        <p>
          Everything is stored in your database. Each change is saved as you make it, and every
          previous version is kept there. Nothing is kept in this browser.
        </p>
        <p role="status">
          {statusText}
          {sync.provider
            ? ` · ${sync.provider === 'postgresql' ? 'PostgreSQL' : 'file vault'}`
            : ''}
          {sync.lastSavedAt ? ` · ${new Date(sync.lastSavedAt).toLocaleString()}` : ''}
        </p>
        {sync.error && (
          <p className="form-error" role="alert">
            {sync.error}
          </p>
        )}
        <div className="action-row">
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await loadFromServer();
                setMessage('Reloaded the latest records from the database.');
              })
            }
          >
            Reload from database
          </button>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                if (
                  hasUnsavedChanges() &&
                  !confirm('A change is still being saved. Sign out anyway and lose it?')
                )
                  return;
                const res = await fetch('/api/auth/session', {
                  method: 'DELETE',
                  signal: AbortSignal.timeout(10000),
                });
                if (!res.ok) throw new Error('Could not sign out of the server. Please retry.');
                discardUnsavedChanges();
                window.location.replace('/login');
              })
            }
          >
            Sign out
          </button>
        </div>
      </section>
      <section className="ember-glass settings-card settings-stack">
        <h2>Backup & restore</h2>
        <p>
          A JSON backup contains your whole ledger and preferences. Keep it somewhere private: it
          holds your financial records.
        </p>
        <div className="action-row">
          <button className="btn btn-primary" onClick={exportBackup}>
            Export JSON backup
          </button>
        </div>
        <label htmlFor="restore-file">
          Preview a JSON backup
          <input
            id="restore-file"
            type="file"
            accept="application/json,.json"
            onChange={(e) =>
              void action(async () => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPreview(null);
                if (file.size > 10485760) throw new Error('Backup must be smaller than 10 MB');
                setPreview(normalizeLedger(JSON.parse(await file.text())));
              })
            }
          />
        </label>
        {preview && (
          <div className="form-stack">
            <p>
              Valid backup: {preview.accounts.length} accounts, {preview.transactions.length}{' '}
              transactions, {preview.transfers.length} transfers, {preview.goals.length} goals.
              Restoring replaces your current records in the database; the current version stays in
              the database history.
            </p>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  if (!confirm('Replace your current records in the database with this backup?'))
                    return;
                  store.importAll(preview);
                  if (!(await saveNow()))
                    throw new Error('The backup could not be saved to the database.');
                  setPreview(null);
                  setMessage('Backup restored. Review account balances before continuing.');
                })
              }
            >
              Restore this backup
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
