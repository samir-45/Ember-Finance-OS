import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';
import { safeReturnPath } from '../src/lib/auth-navigation';
import { authConfigured, authenticated, createSession, ownerSession } from '../src/lib/server/auth';
import { GET, POST, DELETE } from '../src/app/api/auth/session/route';

beforeEach(() => {
  process.env.EMBER_OWNER_PASSWORD = 'auth-regression-only-password';
  process.env.EMBER_SESSION_SECRET = 'auth-regression-only-independent-secret-32-chars';
  process.env.EMBER_PUBLIC_URL = 'https://ember.example';
});

const request = (path: string, token?: string) =>
  new NextRequest(`https://ember.example${path}`, {
    headers: token ? { Cookie: `ember_owner=${token}` } : {},
  });

test('every finance page and root reject anonymous, forged, and expired sessions', () => {
  for (const path of [
    '/',
    '/dashboard',
    '/accounts',
    '/transactions',
    '/allocations',
    '/subscriptions',
    '/budgets',
    '/goals',
    '/reports',
    '/coach',
    '/settings',
    '/settings?tab=privacy',
  ]) {
    for (const token of [undefined, 'forged.cookie', createSession(Date.now() - 13 * 3600000)]) {
      const response = proxy(request(path, token));
      assert.equal(response.status, 307, path);
      assert.equal(new URL(response.headers.get('location')!).pathname, '/login');
      assert.match(response.headers.get('cache-control')!, /no-store/);
    }
  }
});

test('valid owner session opens pages and safely returns from login', () => {
  const token = createSession();
  assert.equal(proxy(request('/accounts', token)).headers.get('x-middleware-next'), '1');
  const response = proxy(request('/login?next=%2Ftransactions%3Ftype%3Dexpense', token));
  assert.equal(response.headers.get('location'), 'https://ember.example/transactions?type=expense');
  assert.equal(proxy(request('/login')).headers.get('x-middleware-next'), '1');
});

test('post-login return paths cannot leave the finance workspace or create login loops', () => {
  for (const path of [
    'https://attacker.example',
    '//attacker.example',
    '/\\attacker.example',
    '/login',
    '/api/db',
    '/_next/static/file.js',
    '/accounts/../../login',
    '/%2f%2fattacker.example',
    '/accounts\n',
  ])
    assert.equal(safeReturnPath(path), '/dashboard', path);
  assert.equal(safeReturnPath('/accounts?currency=BDT'), '/accounts?currency=BDT');
});

test('missing owner password or independent session secret fails closed', () => {
  const token = createSession();
  for (const key of ['EMBER_OWNER_PASSWORD', 'EMBER_SESSION_SECRET'] as const) {
    const saved = process.env[key];
    process.env[key] = '';
    assert.equal(authConfigured(), false);
    assert.equal(authenticated(request('/dashboard', token)), false);
    assert.throws(() => createSession(), /not configured/);
    assert.equal(proxy(request('/dashboard', token)).status, 307);
    process.env[key] = saved;
  }
});

test('session endpoint reports expiry and rejects cross-origin login', async () => {
  const anonymous = await (await GET(request('/api/auth/session'))).json();
  assert.equal(anonymous.authenticated, false);
  assert.equal(anonymous.expiresAt, null);
  const token = createSession();
  const signed = await GET(request('/api/auth/session', token));
  const body = await signed.json();
  assert.equal(body.authenticated, true);
  assert.equal(body.expiresAt, ownerSession(request('/dashboard', token))!.expiresAt);
  assert.match(signed.headers.get('cache-control')!, /no-store/);
  const denied = await POST(
    new Request('https://ember.example/api/auth/session', {
      method: 'POST',
      headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: process.env.EMBER_OWNER_PASSWORD }),
    }),
  );
  assert.equal(denied.status, 403);
});

test('correct login issues an HTTP-only cookie and logout expires it without caching', async () => {
  const makeRequest = (method: string, password?: string) =>
    new Request('https://ember.example/api/auth/session', {
      method,
      headers: { Origin: 'https://ember.example', 'Content-Type': 'application/json' },
      ...(password ? { body: JSON.stringify({ password }) } : {}),
    });
  assert.equal((await POST(makeRequest('POST', 'incorrect'))).status, 401);
  const response = await POST(makeRequest('POST', process.env.EMBER_OWNER_PASSWORD));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie')!, /HttpOnly/i);
  assert.match(response.headers.get('set-cookie')!, /SameSite=strict/i);
  const logout = await DELETE(makeRequest('DELETE'));
  assert.match(logout.headers.get('set-cookie')!, /Max-Age=0/i);
  assert.match(logout.headers.get('cache-control')!, /no-store/);
});
