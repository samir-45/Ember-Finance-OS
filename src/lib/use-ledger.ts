'use client';
import { useSyncExternalStore } from 'react';
import { localDate } from './dates';
import { LEDGER_EVENT, LEDGER_KEY, store } from './store';
export function useLedgerVersion(): string {
  return useSyncExternalStore(
    (callback) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === LEDGER_KEY || event.key === null) callback();
      };
      window.addEventListener(LEDGER_EVENT, callback);
      window.addEventListener('storage', onStorage);
      window.addEventListener('focus', callback);
      document.addEventListener('visibilitychange', callback);
      const clock = window.setInterval(callback, 30000);
      return () => {
        window.removeEventListener(LEDGER_EVENT, callback);
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('focus', callback);
        document.removeEventListener('visibilitychange', callback);
        window.clearInterval(clock);
      };
    },
    () => {
      const s = store.getLocalState();
      return `${s.revision}:${s.mode}:${s.cloudRevision}:${s.dirty}:${localDate()}`;
    },
    () => 'server',
  );
}
