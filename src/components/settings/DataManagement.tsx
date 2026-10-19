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
    window.location.reload();
  };

  return (
    <div className="ember-glass" style={{ padding: '28px' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8 }}>Data & Backup</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
        Export your complete financial records, restore sample freelancer data, or perform a clean wipe.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {/* Export JSON */}
        <button onClick={handleExportBackup} className="btn btn-secondary">
          <Download size={16} />
          Export Full JSON Backup
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
