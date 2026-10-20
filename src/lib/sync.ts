'use client';
import type { LedgerSnapshot } from '@/types';
import { useSyncExternalStore } from 'react';
import { normalizeLedger } from './ledger';
export type SyncState =
  'idle' | 'local' | 'syncing' | 'synced' | 'error' | 'conflict' | 'signed-out';
export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: string | null;
  provider: 'postgresql' | 'file' | null;
  error?: string;
}
let current: SyncStatus = { state: 'idle', lastSyncedAt: null, provider: null };
const serverStatus = current;
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<boolean> | null = null;
let conflictCopy: { data: LedgerSnapshot; revision: number } | null = null;
function status(next: Partial<SyncStatus>) {
  current = { ...current, error: undefined, ...next };
  subscribers.forEach((fn) => fn());
}
export function useSyncStatus() {
  return useSyncExternalStore(
    (fn) => {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    () => current,
    () => serverStatus,
  );
}
export function triggerAutoSync(delay = 1200) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    void syncNow();
  }, delay);
}
async function push(): Promise<boolean> {
  const { store } = await import('./store');
  const sent = store.getLocalState();
  if (sent.mode !== 'cloud') {
    status({ state: 'local', provider: null });
    return true;
  }
  if (current.state === 'conflict') return false;
  if (sent.cloudRevision === null) return pullFromCloud();
  if (!sent.dirty) return true;
  status({ state: 'syncing' });
  try {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision: sent.cloudRevision, data: sent.ledger }),
      signal: AbortSignal.timeout(20000),
    });
    const result = await res.json();
    if (res.status === 409) {
      status({
        state: 'conflict',
        error: 'A newer server copy exists. Review it in Settings; your edits are preserved.',
      });
      return false;
    }
    if (!res.ok) {
      status({
        state: res.status === 401 ? 'signed-out' : 'error',
        error: result.error || 'Save failed',
      });
      return false;
    }
    if (!Number.isSafeInteger(result.revision)) throw new Error('Invalid sync response');
    store.acknowledgeCloud(result.revision, sent.revision);
    status({ state: 'synced', provider: result.provider, lastSyncedAt: new Date().toISOString() });
    if (store.getLocalState().dirty) triggerAutoSync(100);
    return true;
  } catch {
    status({
      state: 'error',
      error: 'Could not reach the server. Unsynced edits remain in this browser.',
    });
    return false;
  }
}
export function syncNow(): Promise<boolean> {
  if (running) return running;
  const task = () => push();
  running = (async () => {
    if (typeof navigator !== 'undefined' && navigator.locks)
      return await navigator.locks.request('ember-cloud-sync', task);
    return await task();
  })().finally(() => {
    running = null;
  });
  return running;
}
export async function pullFromCloud(): Promise<boolean> {
  const { store } = await import('./store');
  if (store.getLocalState().mode !== 'cloud') {
    status({ state: 'local', provider: null });
    return true;
  }
  status({ state: 'syncing' });
  try {
    const res = await fetch('/api/db', { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    const result = await res.json();
    if (!res.ok) {
      status({
        state: res.status === 401 ? 'signed-out' : 'error',
        error: result.error || 'Cannot load server copy',
      });
      return false;
    }
    if (!Number.isSafeInteger(result.revision) || result.revision < 0)
      throw new Error('Invalid cloud revision');
    const remote = normalizeLedger(result.data);
    const latest = store.getLocalState();
    const hasLocal = latest.ledger.accounts.length > 0 || latest.ledger.transactions.length > 0;
    if (
      result.revision > 0 &&
      latest.dirty &&
      hasLocal &&
      latest.cloudRevision !== result.revision
    ) {
      conflictCopy = { data: remote, revision: result.revision };
      status({
        state: 'conflict',
        error: 'Browser and server copies differ. Export both before choosing which to keep.',
      });
      return false;
    }
    if (latest.dirty && latest.cloudRevision === result.revision) {
      status({ state: 'idle', provider: result.provider });
      triggerAutoSync(50);
      return true;
    }
    if (result.revision === 0 && hasLocal) {
      store.setCloudRevisionForReplacement(0);
      status({ state: 'idle', provider: result.provider });
      triggerAutoSync(50);
      return true;
    }
    store.acceptCloud(remote, result.revision);
    status({ state: 'synced', provider: result.provider, lastSyncedAt: new Date().toISOString() });
    return true;
  } catch {
    status({
      state: 'error',
      error: 'Cloud loading failed. Your browser copy has been preserved.',
    });
    return false;
  }
}
export async function getConflictCopy() {
  const res = await fetch('/api/db', { cache: 'no-store' });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Cannot load server copy');
  conflictCopy = { data: normalizeLedger(result.data), revision: result.revision };
  return conflictCopy;
}
export async function resolveConflict(choice: 'server' | 'browser'): Promise<boolean> {
  const { store } = await import('./store');
  if (!conflictCopy) throw new Error('Load and review the latest server copy first');
  const reviewed = conflictCopy;
  store.saveRecoveryCopy();
  if (choice === 'server') {
    store.acceptCloud(reviewed.data, reviewed.revision);
    status({ state: 'synced' });
    conflictCopy = null;
    return true;
  }
  store.setCloudRevisionForReplacement(reviewed.revision);
  status({ state: 'idle' });
  conflictCopy = null;
  return syncNow();
}
