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

test('conflicts preserve settings-only changes and deletion of the last account', async () => {
  for (const settingsOnly of [true, false]) {
    const ledger = emptyLedger();
    if (settingsOnly) ledger.settings.givingPercent = 17;
    memory.set(
      LEDGER_KEY,
      JSON.stringify({
        ledger,
        revision: 50,
        cloudRevision: 1,
        dirty: true,
        mode: 'cloud',
      }),
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          revision: 2,
          data: emptyLedger(),
          provider: 'file',
        }),
      );
    assert.equal(await pullFromCloud(), false);
    assert.deepEqual(store.getSnapshot(), ledger);
    assert.equal(store.getLocalState().dirty, true);
  }
});

test('a delayed server pull cannot reconnect browser-only mode', async () => {
  let complete!: (response: Response) => void;
  globalThis.fetch = () =>
    new Promise<Response>((resolve) => {
      complete = resolve;
    });
  const pending = pullFromCloud();
  while (!complete) await new Promise((resolve) => setImmediate(resolve));
  store.setMode('browser');
  complete(new Response(JSON.stringify({ revision: 3, data: emptyLedger(), provider: 'file' })));
  assert.equal(await pending, false);
  assert.equal(store.getLocalState().mode, 'browser');
  assert.equal(store.getAccounts()[0].name, 'Offline NSave');
});

test('a delayed pull cannot replace a newer acknowledged save', async () => {
  let complete!: (response: Response) => void;
  globalThis.fetch = () =>
    new Promise<Response>((resolve) => {
      complete = resolve;
    });
  const pending = pullFromCloud();
  while (!complete) await new Promise((resolve) => setImmediate(resolve));
  store.acknowledgeCloud(3, store.getLocalState().revision);
  complete(new Response(JSON.stringify({ revision: 2, data: emptyLedger(), provider: 'file' })));
  assert.equal(await pending, false);
  assert.equal(store.getLocalState().cloudRevision, 3);
  assert.equal(store.getAccounts()[0].name, 'Offline NSave');
});

test('a missing server snapshot cannot replace a previously synchronized ledger', async () => {
  store.acknowledgeCloud(5, store.getLocalState().revision);
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        revision: 0,
        data: emptyLedger(),
        provider: 'file',
      }),
    );
  assert.equal(await pullFromCloud(), false);
  assert.equal(store.getAccounts()[0].name, 'Offline NSave');
  assert.equal(store.getLocalState().cloudRevision, 5);
});

test('first connection uploads browser preferences to an untouched revision-one ledger', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ledger = emptyLedger();
  ledger.settings.givingPercent = 17;
  memory.set(
    LEDGER_KEY,
    JSON.stringify({ ledger, revision: 2, cloudRevision: null, dirty: true, mode: 'cloud' }),
  );
  let uploaded: unknown;
  globalThis.fetch = async (_url, options) => {
    if (options?.method === 'POST') {
      uploaded = JSON.parse(String(options.body));
      return new Response(JSON.stringify({ revision: 2, provider: 'file' }));
    }
    return new Response(JSON.stringify({ revision: 1, data: emptyLedger(), provider: 'file' }));
  };
  assert.equal(await pullFromCloud(), true);
  assert.equal(store.getSnapshot().settings.givingPercent, 17);
  assert.equal(await syncNow(), true);
  assert.deepEqual(uploaded, { expectedRevision: 1, data: ledger });
  assert.equal(store.getLocalState().dirty, false);
});

test('first connection still protects customized or subsequently emptied server ledgers', async () => {
  for (const revision of [1, 2]) {
    const local = store.getLocalState();
    memory.set(LEDGER_KEY, JSON.stringify({ ...local, cloudRevision: null }));
    const remote = emptyLedger();
    if (revision === 1) remote.settings.givingPercent = 9;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ revision, data: remote, provider: 'file' }));
    assert.equal(await pullFromCloud(), false);
    assert.equal(store.getAccounts()[0].name, 'Offline NSave');
    assert.equal(store.getLocalState().cloudRevision, null);
  }
});

test('first connection cannot overwrite a competing save after inspecting the empty server', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  memory.set(LEDGER_KEY, JSON.stringify({ ...store.getLocalState(), cloudRevision: null }));
  globalThis.fetch = async (_url, options) =>
    options?.method === 'POST'
      ? new Response(JSON.stringify({ revision: 2 }), { status: 409 })
      : new Response(JSON.stringify({ revision: 1, data: emptyLedger(), provider: 'file' }));
  assert.equal(await pullFromCloud(), true);
  assert.equal(await syncNow(), false);
  assert.equal(store.getAccounts()[0].name, 'Offline NSave');
  assert.equal(store.getLocalState().dirty, true);
});
test('a new browser whose empty copy was reloaded still loads the server ledger without a conflict', async () => {
  // Reloading stores the validated empty ledger, whose field order differs from the template.
  const blank = emptyLedger();
  blank.categories = blank.categories.map(({ type, ...rest }) => ({ ...rest, type }));
  memory.set(
    LEDGER_KEY,
    JSON.stringify({
      ledger: blank,
      revision: 0,
      cloudRevision: null,
      dirty: false,
      mode: 'cloud',
    }),
  );
  const remote = emptyLedger();
  remote.accounts.push({
    id: 'bank',
    name: 'Bank Asia',
    type: 'bank',
    currency: 'BDT',
    openingBalanceMinor: 2500000,
    color: '#fff',
    createdAt: '2026-01-01',
  });
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ success: true, revision: 25, data: remote, provider: 'file' }), {
      status: 200,
    });
  assert.equal(await pullFromCloud(), true);
  assert.equal(store.getAccounts()[0]?.name, 'Bank Asia');
  assert.equal(store.getLocalState().cloudRevision, 25);
});
