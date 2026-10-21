'use client';
import type { LedgerSnapshot } from '@/types';
import { useSyncExternalStore } from 'react';
import { emptyLedger, normalizeLedger } from './ledger';
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
let changedWhileRunning = false;
let conflictCopy: { data: LedgerSnapshot; revision: number } | null = null;
export function getSyncStatus(): SyncStatus {
  return current;
}
function status(next: Partial<SyncStatus>) {
  current = { ...current, error: undefined, ...next };
  subscribers.forEach((fn) => fn());
  if (next.state === 'signed-out' && typeof window !== 'undefined')
    window.dispatchEvent(new Event('ember-owner-session-expired'));
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
export function triggerAutoSync() {
  if (running) {
    changedWhileRunning = true;
    return;
  }
  if (timer) return;
  // Let the local save finish and coalesce changes made in the same turn.
  timer = setTimeout(() => {
    timer = undefined;
    void syncNow();
  }, 0);
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
    if (store.getLocalState().dirty) triggerAutoSync();
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
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  const task = () => push();
  running = (async () => {
    if (typeof navigator !== 'undefined' && navigator.locks)
      return await navigator.locks.request('ember-cloud-sync', task);
    return await task();
  })().finally(() => {
    running = null;
    if (changedWhileRunning) {
      changedWhileRunning = false;
      if (current.state !== 'conflict' && current.state !== 'signed-out') triggerAutoSync();
    }
  });
  return running;
}
export async function pullFromCloud(): Promise<boolean> {
  const { store } = await import('./store');
  const started = store.getLocalState();
  if (started.mode !== 'cloud') {
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
    // A delayed response must not reconnect a paused workspace or replace a
    // snapshot acknowledged by a newer request while this GET was in flight.
    if (latest.mode !== 'cloud') {
      status({ state: 'local', provider: null });
      return false;
    }
    if (latest.cloudRevision !== started.cloudRevision) return false;
    const hasLocal =
      latest.dirty || JSON.stringify(latest.ledger) !== JSON.stringify(emptyLedger());
    // The fresh-start tool creates revision 1 even though no owner data exists.
    // Only an untouched initial snapshot may be bootstrapped on first connection;
    // later empty revisions can represent intentional deletions on another device.
    if (
      latest.cloudRevision === null &&
      result.revision === 1 &&
      hasLocal &&
      JSON.stringify(remote) === JSON.stringify(normalizeLedger(emptyLedger()))
    ) {
      store.setCloudRevisionForReplacement(result.revision);
      conflictCopy = null;
      status({ state: 'idle', provider: result.provider });
      triggerAutoSync();
      return true;
    }
    if (
      result.revision < (latest.cloudRevision ?? 0) ||
      (result.revision > 0 &&
        (latest.dirty || (latest.cloudRevision === null && hasLocal)) &&
        latest.cloudRevision !== result.revision)
    ) {
      conflictCopy = { data: remote, revision: result.revision };
      status({
        state: 'conflict',
        provider: result.provider,
        error: 'Browser and server copies differ. Export both before choosing which to keep.',
      });
      return false;
    }
    if (latest.dirty && latest.cloudRevision === result.revision) {
      status({ state: 'idle', provider: result.provider });
      triggerAutoSync();
      return true;
    }
    if (result.revision === 0 && hasLocal) {
      store.setCloudRevisionForReplacement(0);
      status({ state: 'idle', provider: result.provider });
      triggerAutoSync();
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
  const res = await fetch('/api/db', { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Cannot load server copy');
  if (!Number.isSafeInteger(result.revision) || result.revision < 0)
    throw new Error('Invalid cloud revision');
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
