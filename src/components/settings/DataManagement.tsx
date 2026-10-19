'use client';

import { useState } from 'react';
import { Download, RefreshCw, Trash2, AlertTriangle, Cloud, CheckCircle2 } from 'lucide-react';
import { store } from '@/lib/store';
import { seedData } from '@/data/seed';
import { syncNow, useSyncStatus } from '@/lib/sync';

export function DataManagement() {
  const sync = useSyncStatus();
  const [resetConfirm, setResetConfirm] = useState(false);
  const [seedConfirm, setSeedConfirm] = useState(false);
  const [seededToast, setSeededToast] = useState(false);
  const [manualSyncing, setManualSyncing] = useState(false);

  // Manual Trigger for Force Cloud Re-sync
  const handleForceSync = async () => {
    setManualSyncing(true);
    await syncNow();
    setManualSyncing(false);
  };

  // Export JSON Backup
  const handleExportBackup = () => {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      accounts: store.getAccounts(),
      categories: store.getCategories(),
      transactions: store.getTransactions(),
      subscriptions: store.getSubscriptions(),
      budgets: store.getBudgets(),
      goals: store.getGoals(),
      transfers: store.getTransfers(),
      exchangeRates: store.getExchangeRates(),
      settings: store.getSettings(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ember_finance_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Re-seed Data
  const handleReSeed = () => {
    seedData();
    setSeedConfirm(false);
    setSeededToast(true);
    syncNow(); // Push freshly seeded data to Neon
    setTimeout(() => {
      setSeededToast(false);
      window.location.reload();
    }, 1200);
  };

  // Reset All Data
  const handleFactoryReset = async () => {
    store.resetAll();
    try {
      await fetch('/api/db', { method: 'DELETE' });
    } catch (err) {
      console.warn('Failed cloud wipe:', err);
    }
    window.location.reload();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── 1. Data Portability & Offline Backup ── */}
      <div className="ember-glass" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Data Portability & Offline Backup</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {sync.lastSyncedAt && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Synced {sync.lastSyncedAt}
              </span>
            )}
            <span
              style={{
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: sync.state === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(110, 231, 168, 0.1)',
                color: sync.state === 'error' ? 'var(--color-critical)' : 'var(--color-income)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {sync.state === 'syncing' ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  Syncing to Neon...
                </>
              ) : sync.state === 'error' ? (
                <>
                  <AlertTriangle size={12} />
                  Sync Warning
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} />
                  Auto-Sync to Neon Active
                </>
              )}
            </span>
          </div>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
          Your financial records are automatically persisted in real time to your Neon PostgreSQL cloud database. You can download an offline JSON archive anytime for personal backups or tax filing.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {/* Export JSON File */}
          <button onClick={handleExportBackup} className="btn btn-primary btn-sm">
            <Download size={15} />
            Export JSON Archive
          </button>

          {/* Force Cloud Re-sync */}
          <button
            onClick={handleForceSync}
            disabled={manualSyncing || sync.state === 'syncing'}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw size={15} className={manualSyncing ? 'animate-spin' : ''} />
            <span>{manualSyncing ? 'Syncing...' : 'Force Cloud Re-sync'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. Danger Zone (Demo Data & Factory Reset) ── */}
      <div
        className="ember-glass"
        style={{
          padding: '28px',
          borderLeft: '4px solid var(--color-critical)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: 'var(--color-critical)' }}>
            <AlertTriangle size={18} />
          </span>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-critical)' }}>
            Danger Zone
          </h2>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 20 }}>
          Destructive operations and demo tools. Proceed with caution when managing live financial data.
        </p>

        {seededToast && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(110, 231, 168, 0.1)', color: 'var(--color-income)', fontSize: '0.8125rem' }}>
            Sample freelancer records populated! Refreshing workspace...
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Seed Sample Demo Data */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Populate Sample Freelancer Data</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Replaces current records with 6 months of sample multi-currency freelancer data for demonstration.
              </p>
            </div>
            {!seedConfirm ? (
              <button
                onClick={() => setSeedConfirm(true)}
                className="btn btn-secondary btn-sm"
              >
                Seed Demo Data
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-warning)' }}>Overwrite records?</span>
                <button
                  onClick={handleReSeed}
                  className="btn btn-sm"
                  style={{ background: 'var(--color-warning)', color: '#000', fontWeight: 600 }}
                >
                  Confirm Seed
                </button>
                <button onClick={() => setSeedConfirm(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Factory Reset */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-critical)' }}>Wipe All Records & Clean Reset</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Permanently wipes all accounts, transactions, and budgets from both local storage and Neon PostgreSQL.
              </p>
            </div>
            {!resetConfirm ? (
              <button
                onClick={() => setResetConfirm(true)}
                className="btn btn-sm"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--color-critical)',
                  gap: 6,
                }}
              >
                <Trash2 size={14} />
                Reset Ledger
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-critical)' }}>Permanently erase all data?</span>
                <button
                  onClick={handleFactoryReset}
                  className="btn btn-sm"
                  style={{ background: 'var(--color-critical)', color: '#fff', fontWeight: 600 }}
                >
                  Yes, Erase Everything
                </button>
                <button onClick={() => setResetConfirm(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
