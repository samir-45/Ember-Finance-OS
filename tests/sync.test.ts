import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { emptyLedger } from '../src/lib/ledger';
import { LEDGER_KEY, store } from '../src/lib/store';
import { pullFromCloud, syncNow } from '../src/lib/sync';
const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
  },
});
beforeEach(() => {
  memory.clear();
  const ledger = emptyLedger();
  ledger.accounts.push({
    id: 'local',
    name: 'Offline NSave',
    type: 'bank',
    currency: 'USD',
    openingBalanceMinor: 100000,
    color: '#fff',
    createdAt: '2026-01-01',
  });
  memory.set(
    LEDGER_KEY,
    JSON.stringify({ ledger, revision: 42, cloudRevision: 1, dirty: true, mode: 'cloud' }),
  );
});
test('startup preserves dirty offline edits when server revision differs', async () => {
  const remote = emptyLedger();
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ success: true, revision: 2, data: remote, provider: 'file' }), {
      status: 200,
    });
  assert.equal(await pullFromCloud(), false);
  assert.equal(store.getAccounts()[0].name, 'Offline NSave');
  assert.equal(store.getLocalState().dirty, true);
});
test('browser-only mode never uploads records', async () => {
  store.setMode('browser');
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    throw new Error('No network');
  };
  assert.equal(await syncNow(), true);
  assert.equal(requests, 0);
});
