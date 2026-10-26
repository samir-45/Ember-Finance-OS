import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { emptyLedger } from '../src/lib/ledger';
import { store } from '../src/lib/store';
import { getSyncStatus, hasUnsavedChanges, loadFromServer, saveNow } from '../src/lib/sync';
import type { LedgerSnapshot } from '../src/types';

Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });

// A stand-in for /api/db with the same revision rules as the real handler.
const db = { revision: 0, data: emptyLedger() as LedgerSnapshot, posts: 0, down: false };
const account = (id: string, name: string) => ({
  id,
  name,
  type: 'bank' as const,
  currency: 'BDT' as const,
  openingBalanceMinor: 100000,
  color: '#fff',
  createdAt: '2026-01-01',
});
globalThis.fetch = async (_url, options) => {
  if (db.down) throw new TypeError('fetch failed');
  if (options?.method === 'POST') {
    db.posts++;
    const body = JSON.parse(String(options.body));
    if (body.expectedRevision !== db.revision)
      return new Response(JSON.stringify({ error: 'Stale revision' }), { status: 409 });
    db.revision++;
    db.data = body.data;
    return new Response(JSON.stringify({ revision: db.revision, provider: 'postgresql' }));
  }
  return new Response(
    JSON.stringify({ revision: db.revision, data: db.data, provider: 'postgresql' }),
  );
};
const idle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await saveNow();
};

beforeEach(async () => {
  const data = emptyLedger();
  data.accounts.push(account('bank', 'Bank Asia'));
  Object.assign(db, { revision: 5, data, posts: 0, down: false });
  await loadFromServer();
});

test('opening the app shows exactly what the database holds', () => {
  assert.equal(store.getAccounts()[0].name, 'Bank Asia');
  assert.equal(store.revision(), 5);
  assert.equal(getSyncStatus().state, 'saved');
});

test('each change is saved straight to the database', async () => {
  store.createAccount({ ...account('x', 'bKash'), id: undefined } as never);
  assert.equal(hasUnsavedChanges(), true);
  await idle();
  assert.equal(hasUnsavedChanges(), false);
  assert.equal(db.revision, 6);
  assert.deepEqual(
    db.data.accounts.map((a) => a.name),
    ['Bank Asia', 'bKash'],
  );
  assert.equal(getSyncStatus().state, 'saved');
});

test('changes made while a save is in flight are saved next, in order', async () => {
  store.updateAccount('bank', { name: 'First' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  store.updateAccount('bank', { name: 'Second' });
  await idle();
  assert.equal(db.data.accounts[0].name, 'Second');
  assert.equal(store.revision(), db.revision);
});

test('nothing is sent when nothing changed', async () => {
  await saveNow();
  assert.equal(db.posts, 0);
});

test('a change rejected because another device saved first is replaced by the database copy', async () => {
  const other = structuredClone(db.data);
  other.accounts[0].name = 'Renamed on phone';
  db.data = other;
  db.revision = 6;
  store.updateAccount('bank', { name: 'Renamed here' });
  await idle();
  assert.equal(store.getAccounts()[0].name, 'Renamed on phone');
  assert.equal(store.revision(), 6);
  assert.equal(getSyncStatus().state, 'error');
  assert.match(getSyncStatus().error!, /another device or tab.*latest saved records/);
});

test('if the database cannot be reached, the screen says the change is not saved', async () => {
  db.down = true;
  store.updateAccount('bank', { name: 'Offline rename' });
  await idle();
  assert.equal(getSyncStatus().state, 'error');
  assert.match(getSyncStatus().error!, /not saved/);
  assert.equal(db.data.accounts[0].name, 'Bank Asia');
});

test('a failed load keeps the current view and reports why', async () => {
  db.down = true;
  await assert.rejects(loadFromServer(), /reach the database/);
  assert.equal(store.getAccounts()[0].name, 'Bank Asia');
});

test('ledgers loaded only in memory are never sent to the database', async () => {
  store.hydrate(emptyLedger());
  store.createAccount({ ...account('y', 'Preview'), id: undefined } as never);
  await idle();
  assert.equal(db.posts, 0);
});

test('a reload that started before an edit cannot overwrite that edit when it returns', async () => {
  const realFetch = globalThis.fetch;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const stale = structuredClone(db.data);
  globalThis.fetch = async (url, options) => {
    if (options?.method !== 'POST') {
      await gate;
      return new Response(JSON.stringify({ revision: 5, data: stale, provider: 'postgresql' }));
    }
    return realFetch(url, options);
  };
  try {
    const reload = loadFromServer();
    store.updateAccount('bank', { name: 'Edited during reload' });
    release();
    await reload;
    globalThis.fetch = realFetch;
    await idle();
    assert.equal(store.getAccounts()[0].name, 'Edited during reload');
    assert.equal(db.data.accounts[0].name, 'Edited during reload');
  } finally {
    globalThis.fetch = realFetch;
  }
});
