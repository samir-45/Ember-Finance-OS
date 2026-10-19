'use client';

import { useState } from 'react';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import { store } from '@/lib/store';
import { seedData } from '@/data/seed';

export function DataManagement() {
  const [resetConfirm, setResetConfirm] = useState(false);
  const [seededToast, setSeededToast] = useState(false);

  // Re-seed Data
  const handleReSeed = () => {
    seedData();
    setSeededToast(true);
    setTimeout(() => setSeededToast(false), 2500);
  };

  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Sync to Server Vault API
  const handleServerSync = async () => {
    setSyncStatus('Syncing to server...');
    try {
      const payload = {
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
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSyncStatus('Server Database Synchronized! ✓');
      } else {
        setSyncStatus('Server sync failed');
      }
    } catch {
      setSyncStatus('Server sync failed');
    }
    setTimeout(() => setSyncStatus(null), 3000);
  };

  // Restore from Server Vault API
  const handleServerRestore = async () => {
    setSyncStatus('Checking server...');
    try {
      const res = await fetch('/api/db');
      const result = await res.json();
      if (result.exists && result.data) {
        store.importAll(result.data);
        setSyncStatus('Restored from Server Vault! ✓');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setSyncStatus('No server snapshot found');
      }
    } catch {
      setSyncStatus('Server restore failed');
    }
    setTimeout(() => setSyncStatus(null), 3000);
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

  // Reset All Data
  const handleFactoryReset = () => {
    store.resetAll();
    fetch('/api/db', { method: 'DELETE' }).catch(() => {});
    window.location.reload();
  };

  return (
    <div className="ember-glass" style={{ padding: '28px' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8 }}>Data & Server Database Vault</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
        Synchronize your ledger with the persistent server vault API, export standalone JSON snapshots, or reset records cleanly.
      </p>

      {syncStatus && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,59,31,0.1)', color: 'var(--color-accent)', fontSize: '0.8125rem' }}>
          {syncStatus}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {/* Sync to Server Database */}
        <button onClick={handleServerSync} className="btn btn-primary">
          <RefreshCw size={16} />
          Sync to Server Database Vault
        </button>

        {/* Restore from Server Database */}
        <button onClick={handleServerRestore} className="btn btn-secondary">
          <Download size={16} />
          Pull from Server Vault
        </button>

        {/* Export JSON */}
        <button onClick={handleExportBackup} className="btn btn-secondary">
          <Download size={16} />
          Export JSON File
        </button>

        {/* Re-seed realistic data */}
        <button onClick={handleReSeed} className="btn btn-secondary">
          <RefreshCw size={16} />
          {seededToast ? 'Sample Data Refreshed!' : 'Seed 6-Month Realistic Data'}
        </button>

        {/* Factory Reset */}
        {!resetConfirm ? (
          <button
            onClick={() => setResetConfirm(true)}
            className="btn btn-ghost"
            style={{ color: 'var(--color-critical)' }}
          >
            <Trash2 size={16} />
            Reset All Records
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-critical)' }}>Are you sure?</span>
            <button
              onClick={handleFactoryReset}
              className="btn btn-sm"
              style={{ background: 'var(--color-critical)', color: '#fff' }}
            >
              Yes, Wipe Everything
            </button>
            <button onClick={() => setResetConfirm(false)} className="btn btn-secondary btn-sm">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
