'use client';

import { useState, useEffect } from 'react';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: string | null;
  provider: 'postgresql_drizzle' | 'local_vault' | null;
  error?: string;
}

let currentStatus: SyncStatus = {
  state: 'idle',
  lastSyncedAt: null,
  provider: null,
};

const SYNC_EVENT = 'ember_sync_status_changed';
let debounceTimer: NodeJS.Timeout | null = null;

function emitStatus(newStatus: Partial<SyncStatus>) {
  currentStatus = { ...currentStatus, ...newStatus };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: currentStatus }));
  }
}

/**
 * Pushes entire ledger snapshot to /api/db (Neon PostgreSQL)
 */
export async function syncNow(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  emitStatus({ state: 'syncing' });

  try {
    // Dynamic import to avoid circular dependency
    const { store } = await import('@/lib/store');

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
      emitStatus({
        state: 'synced',
        lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        provider: data.provider || 'postgresql_drizzle',
      });
      return true;
    } else {
      emitStatus({ state: 'error', error: data.error || 'Sync failed' });
      return false;
    }
  } catch (err: any) {
    emitStatus({ state: 'error', error: err.message });
    return false;
  }
}

/**
 * Debounced background sync triggered whenever any transaction/record is modified
 */
export function triggerAutoSync(delayMs = 1200) {
  if (typeof window === 'undefined') return;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    syncNow();
  }, delayMs);
}

/**
 * On first boot, check if cloud has existing records to pull down
 */
export async function pullFromCloud(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  emitStatus({ state: 'syncing' });

  try {
    const res = await fetch('/api/db');
    const result = await res.json();

    if (result.exists && result.data) {
      const { store } = await import('@/lib/store');
      const d = result.data;

      // Only pull if cloud has records
      const hasCloudData = (d.transactions && d.transactions.length > 0) || (d.accounts && d.accounts.length > 0);
      if (hasCloudData) {
        store.importAll(d);
        emitStatus({
          state: 'synced',
          lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          provider: result.provider || 'postgresql_drizzle',
        });
        return true;
      }
    }

    // If cloud is empty, push initial state to cloud
    await syncNow();
    return true;
  } catch (err: any) {
    emitStatus({ state: 'idle' });
    return false;
  }
}

/**
 * React hook for UI components to display real-time cloud sync status
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(currentStatus);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<SyncStatus>;
      if (custom.detail) {
        setStatus(custom.detail);
      }
    };

    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  return status;
}
