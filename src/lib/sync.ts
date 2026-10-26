'use client';
import { useSyncExternalStore } from 'react';
export type SyncState = 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'signed-out';
export interface SyncStatus {
  state: SyncState;
  lastSavedAt: string | null;
  provider: 'postgresql' | 'file' | null;
  error?: string;
}
let current: SyncStatus = { state: 'idle', lastSavedAt: null, provider: null };
const serverStatus = current;
const subscribers = new Set<() => void>();
let queued: ReturnType<typeof setTimeout> | undefined;
let running: Promise<boolean> | null = null;
let savedVersion = -1; // store version the database is known to hold
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
/** True while a change shown on screen has not been confirmed by the database yet. */
export function hasUnsavedChanges(): boolean {
  return !discarded && Boolean(queued || running);
}
let discarded = false;
/** The owner chose to leave without the pending change (e.g. signing out); don't ask again. */
export function discardUnsavedChanges() {
  discarded = true;
  if (queued) clearTimeout(queued);
  queued = undefined;
}

/** Reads the ledger from the database. Throws when it cannot, so nothing stale is shown. */
export async function loadFromServer(): Promise<void> {
  const { store } = await import('./store');
  status({ state: 'loading' });
  let res: Response;
  try {
    res = await fetch('/api/db', { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  } catch {
    status({ state: 'error', error: 'Could not reach the database. Check your connection.' });
    throw new Error(current.error);
  }
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    status({
      state: res.status === 401 ? 'signed-out' : 'error',
      error: result.error || 'Could not load your records from the database.',
    });
    throw new Error(current.error);
  }
  if (!Number.isSafeInteger(result.revision) || result.revision < 0)
    throw new Error('The database returned an invalid revision.');
  store.replaceFromServer(result.data, result.revision);
  savedVersion = store.version();
  status({ state: 'saved', provider: result.provider ?? null });
}

/** Called after every change; changes made in the same moment are saved together. */
export function queueSave() {
  if (queued || running) {
    // A save in flight re-checks for newer edits when it finishes.
    return;
  }
  queued = setTimeout(() => {
    queued = undefined;
    void saveNow();
  }, 0);
}

export function saveNow(): Promise<boolean> {
  if (running) return running;
  running = save().finally(() => {
    running = null;
  });
  return running;
}

async function save(): Promise<boolean> {
  const { store } = await import('./store');
  // Keep saving until the database holds everything shown on screen.
  while (store.isConnected() && store.version() !== savedVersion) {
    const sentVersion = store.version();
    status({ state: 'saving' });
    let res: Response;
    try {
      res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: store.revision(), data: store.getSnapshot() }),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      return failed('Your last change could not be saved because the database was unreachable.');
    }
    const result = await res.json().catch(() => ({}));
    if (res.status === 401) {
      status({ state: 'signed-out', error: 'Your session ended. Sign in again.' });
      return false;
    }
    if (res.status === 409)
      return failed(
        'Your last change was not saved because your records were changed on another device or tab.',
      );
    if (!res.ok || !Number.isSafeInteger(result.revision))
      return failed(result.error || 'Your last change could not be saved.');
    store.markSaved(result.revision);
    savedVersion = sentVersion;
    status({
      state: store.version() === sentVersion ? 'saved' : 'saving',
      provider: result.provider ?? null,
      lastSavedAt: new Date().toISOString(),
    });
  }
  return true;
}

// After a failed save the screen must match the database again: reload the saved copy.
async function failed(message: string): Promise<false> {
  try {
    await loadFromServer();
    status({ state: 'error', error: `${message} The latest saved records are shown.` });
  } catch {
    status({
      state: 'error',
      error: `${message} What you see is not saved; reload once the database is reachable.`,
    });
  }
  return false;
}
