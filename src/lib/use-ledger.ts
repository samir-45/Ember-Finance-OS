'use client';
import { useSyncExternalStore } from 'react';
import { LEDGER_EVENT, LEDGER_KEY, store } from './store';
export function useLedgerVersion(): string {
  return useSyncExternalStore(
    (callback) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === LEDGER_KEY || event.key === null) callback();
      };
      window.addEventListener(LEDGER_EVENT, callback);
      window.addEventListener('storage', onStorage);
      return () => {
        window.removeEventListener(LEDGER_EVENT, callback);
        window.removeEventListener('storage', onStorage);
      };
    },
    () => {
      const s = store.getLocalState();
      return `${s.revision}:${s.mode}:${s.cloudRevision}:${s.dirty}`;
    },
    () => 'server',
  );
}
