'use client';
import { useSyncExternalStore } from 'react';
import { localDate } from './dates';
import { LEDGER_EVENT, store } from './store';
export function useLedgerVersion(): string {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener(LEDGER_EVENT, callback);
      window.addEventListener('focus', callback);
      document.addEventListener('visibilitychange', callback);
      // Date-based views (this month, due bills) roll over without a reload.
      const clock = window.setInterval(callback, 30000);
      return () => {
        window.removeEventListener(LEDGER_EVENT, callback);
        window.removeEventListener('focus', callback);
        document.removeEventListener('visibilitychange', callback);
        window.clearInterval(clock);
      };
    },
    () => `${store.version()}:${localDate()}`,
    () => 'server',
  );
}
