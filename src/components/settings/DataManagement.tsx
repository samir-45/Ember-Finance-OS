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
import { SettingRow, SettingsGroup } from './SettingsUI';

function useAction() {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => void | Promise<void>) => {
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
  const feedback = (
    <>
      {error && (
        <p className="form-error setting-feedback" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success setting-feedback" role="status">
          {message}
        </p>
      )}
    </>
  );
  return { run, busy, feedback, setMessage };
}

export function SignOutRow() {
  const { run, busy, feedback } = useAction();
  return (
    <>
      <SettingRow title="Sign out" description="Closes Ember on this device.">
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
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
      </SettingRow>
      {feedback}
    </>
  );
}

export function DataManagement() {
  const sync = useSyncStatus();
  const { run, busy, feedback, setMessage } = useAction();
  const [preview, setPreview] = useState<LedgerSnapshot | null>(null);
  const status =
    sync.state === 'saving'
      ? 'Saving…'
      : sync.state === 'loading'
        ? 'Loading…'
        : sync.state === 'error'
          ? 'Not saved'
          : 'All changes saved';
  return (
    <SettingsGroup
      id="data"
      title="Your data"
      description="Everything lives in your database and every change saves as you make it. Previous versions are kept there too."
    >
      <SettingRow
        title={status}
        description={
          <span role="status">
            {sync.provider === 'postgresql' ? 'PostgreSQL database' : 'File vault'}
            {sync.lastSavedAt ? ` · last saved ${new Date(sync.lastSavedAt).toLocaleString()}` : ''}
            {sync.error && <span className="form-error"> · {sync.error}</span>}
          </span>
        }
      >
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await loadFromServer();
              setMessage('Reloaded the latest records from the database.');
            })
          }
        >
          Reload
        </button>
      </SettingRow>
      <SettingRow
        title="Download a backup"
        description="One JSON file with all your records and settings. Keep it private."
      >
        <button
          className="btn btn-secondary"
          onClick={() =>
            downloadFile(
              JSON.stringify(
                { ...store.getSnapshot(), exportedAt: new Date().toISOString() },
                null,
                2,
              ),
              `ember-backup-${localDate()}.json`,
              'application/json',
            )
          }
        >
          Download
        </button>
      </SettingRow>
      <SettingRow
        title="Restore a backup"
        description="Choose a backup file to check it first. Nothing changes until you confirm."
      >
        <input
          id="restore-file"
          className="file-input"
          type="file"
          accept="application/json,.json"
          aria-label="Preview a JSON backup"
          onChange={(e) =>
            void run(async () => {
              const file = e.target.files?.[0];
              if (!file) return;
              setPreview(null);
              if (file.size > 10485760) throw new Error('Backup must be smaller than 10 MB');
              setPreview(normalizeLedger(JSON.parse(await file.text())));
            })
          }
        />
      </SettingRow>
      {preview && (
        <div className="setting-row setting-row-stacked">
          <p>
            Valid backup: {preview.accounts.length} accounts, {preview.transactions.length}{' '}
            transactions, {preview.transfers.length} transfers, {preview.goals.length} goals.
            Restoring replaces your current records; the current version stays in the database
            history.
          </p>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={() =>
              void run(async () => {
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
      {feedback}
    </SettingsGroup>
  );
}
