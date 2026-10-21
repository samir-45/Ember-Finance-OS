import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { POST as aiCoach } from '../src/app/api/ai/coach/route';
import { POST as aiParse } from '../src/app/api/ai/parse/route';
import { DELETE, GET, POST } from '../src/app/api/db/route';
import { emptyLedger } from '../src/lib/ledger';
import { authenticated, createSession, verifyPassword } from '../src/lib/server/auth';
let directory: string;
before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ember-regression-'));
  process.env.DATABASE_URL = 'placeholder_test';
  process.env.EMBER_OWNER_PASSWORD = 'test-only-password-at-least-32-characters';
  process.env.EMBER_SESSION_SECRET = 'test-only-independent-session-secret-at-least-32-characters';
  process.env.EMBER_STORAGE_DRIVER = 'file';
  process.env.EMBER_VAULT_PATH = path.join(directory, 'vault.json');
  process.env.EMBER_ENABLE_EXTERNAL_AI = 'false';
});
after(async () => {
  await fs.rm(directory, { recursive: true, force: true });
});
function request(method = 'GET', body?: unknown, auth = true, origin = 'http://localhost:3100') {
  return new Request('http://localhost:3100/api/db', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      ...(auth ? { Cookie: `ember_owner=${createSession()}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
test('owner sessions reject missing, forged, expired, and rotated-password cookies', () => {
  assert.equal(authenticated(request()), true);
  assert.equal(authenticated(request('GET', undefined, false)), false);
  assert.equal(verifyPassword('wrong'), false);
  const expired = new Request('http://localhost', {
    headers: { Cookie: `ember_owner=${createSession(Date.now() - 13 * 3600000)}` },
  });
  assert.equal(authenticated(expired), false);
  const token = createSession();
  const password = process.env.EMBER_OWNER_PASSWORD;
  process.env.EMBER_OWNER_PASSWORD = 'a-different-long-owner-password';
  assert.equal(
    authenticated(new Request('http://localhost', { headers: { Cookie: `ember_owner=${token}` } })),
    false,
  );
  process.env.EMBER_OWNER_PASSWORD = password;
});
test('all financial and AI routes require owner authorization before touching storage', async () => {
  assert.equal((await GET(request('GET', undefined, false))).status, 401);
  assert.equal((await POST(request('POST', {}, false))).status, 401);
  assert.equal((await DELETE(request('DELETE', {}, false))).status, 401);
  assert.equal((await aiCoach(request('POST', {}, false))).status, 401);
  assert.equal((await aiParse(request('POST', {}, false))).status, 401);
  assert.equal((await POST(request('POST', {}, true, 'https://attacker.example'))).status, 403);
});
test('a versioned full snapshot preserves deletions, preferences and prior revisions', async () => {
  const data = emptyLedger();
  data.settings.givingPercent = 7;
  data.categories.push({
    id: 'custom',
    name: 'Custom',
    parentId: null,
    type: 'expense',
    color: '#fff',
    icon: 'wallet',
    budgetGroup: 'needs',
  });
  let res = await POST(request('POST', { expectedRevision: 0, data }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).revision, 1);
  data.categories = data.categories.filter((c) => c.id !== 'custom');
  res = await POST(request('POST', { expectedRevision: 1, data }));
  assert.equal(res.status, 200);
  const cloud = await (await GET(request())).json();
  assert.equal(cloud.revision, 2);
  assert.equal(cloud.data.settings.givingPercent, 7);
  assert.equal(
    cloud.data.categories.some((c: { id: string }) => c.id === 'custom'),
    false,
  );
  const history = JSON.parse(
    await fs.readFile(`${process.env.EMBER_VAULT_PATH}.revision-1.json`, 'utf8'),
  );
  assert.equal(
    history.data.categories.some((c: { id: string }) => c.id === 'custom'),
    true,
  );
});
test('stale revisions cannot overwrite newer data and invalid snapshots do not partially write', async () => {
  const before = await fs.readFile(process.env.EMBER_VAULT_PATH!, 'utf8');
  const stale = await POST(request('POST', { expectedRevision: 0, data: emptyLedger() }));
  assert.equal(stale.status, 409);
  const invalid = await POST(
    request('POST', {
      expectedRevision: 2,
      data: { ...emptyLedger(), accounts: [{ id: 'broken' }] },
    }),
  );
  assert.equal(invalid.status, 400);
  assert.equal(await fs.readFile(process.env.EMBER_VAULT_PATH!, 'utf8'), before);
});
test('concurrent writers have a single winner and never mix ledger snapshots', async () => {
  const a = emptyLedger(),
    b = emptyLedger();
  a.settings.givingPercent = 11;
  b.settings.givingPercent = 22;
  const res = await Promise.all([
    POST(request('POST', { expectedRevision: 2, data: a })),
    POST(request('POST', { expectedRevision: 2, data: b })),
  ]);
  assert.equal(res.filter((r) => r.status === 200).length, 1);
  assert.equal(res.filter((r) => r.status !== 200).length, 1);
  const current = await (await GET(request())).json();
  assert.equal(current.revision, 3);
  assert.ok([11, 22].includes(current.data.settings.givingPercent));
});
test('storage outages fail visibly without silently falling back or claiming success', async () => {
  const file = process.env.EMBER_VAULT_PATH;
  delete process.env.EMBER_VAULT_PATH;
  assert.equal(
    (await POST(request('POST', { expectedRevision: 3, data: emptyLedger() }))).status,
    503,
  );
  assert.equal((await GET(request())).status, 503);
  process.env.EMBER_VAULT_PATH = file;
});
test('external AI requires explicit request consent even for an authenticated owner', async () => {
  assert.equal((await aiCoach(request('POST', {}))).status, 400);
  assert.equal((await aiParse(request('POST', { text: 'private text' }))).status, 400);
  const body = {
    consent: { enabled: true, share: true },
    incomeUsdMinor: 100000,
    expenseUsdMinor: 20000,
    savingsRate: 80,
    runwayMonths: 0,
    hasExpenseHistory: false,
    subBurdenPercent: 0,
    topCategories: [],
  };
  assert.equal((await aiCoach(request('POST', body))).status, 503);
});
