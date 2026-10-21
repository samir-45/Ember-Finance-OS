import { NextResponse } from 'next/server';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE = 'ember_owner';
export const authConfigured = () =>
  (process.env.EMBER_OWNER_PASSWORD?.length ?? 0) >= 16 &&
  (process.env.EMBER_SESSION_SECRET?.length ?? 0) >= 32;
const secret = () =>
  createHash('sha256')
    .update(
      `ember-owner-session-v2:${process.env.EMBER_SESSION_SECRET ?? ''}:${process.env.EMBER_OWNER_PASSWORD ?? ''}`,
    )
    .digest();
export function createSession(now = Date.now()): string {
  if (!authConfigured()) throw new Error('Owner sign-in is not configured');
  const payload = Buffer.from(
    JSON.stringify({
      owner: 'owner',
      expires: now + 12 * 3600000,
      nonce: randomBytes(20).toString('hex'),
    }),
  ).toString('base64url');
  return `${payload}.${createHmac('sha256', secret()).update(payload).digest('base64url')}`;
}
export function ownerSession(req: Request, now = Date.now()): { expiresAt: number } | null {
  if (!authConfigured()) return null;
  const token = req.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!token) return null;
  try {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return null;
    const expected = createHmac('sha256', secret()).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const valid =
      data.owner === 'owner' &&
      typeof data.expires === 'number' &&
      data.expires > now &&
      data.expires <= now + 12 * 3600000;
    return valid ? { expiresAt: data.expires } : null;
  } catch {
    return null;
  }
}
export function authenticated(req: Request, now = Date.now()): boolean {
  return ownerSession(req, now) !== null;
}
export function verifyPassword(password: string): boolean {
  if (!authConfigured()) return false;
  return timingSafeEqual(
    createHash('sha256').update(password).digest(),
    createHash('sha256').update(process.env.EMBER_OWNER_PASSWORD!).digest(),
  );
}
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  return origin === new URL(process.env.EMBER_PUBLIC_URL || req.url).origin;
}
export function requireOwner(req: Request): NextResponse | null {
  if (!authenticated(req))
    return NextResponse.json(
      { error: 'Owner sign-in required' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  if (!['GET', 'HEAD'].includes(req.method) && !sameOrigin(req))
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  return null;
}
export function sessionCookie(value: string, maxAge = 12 * 3600) {
  return {
    name: COOKIE,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}
export async function readJson(req: Request, maxBytes = 10 * 1024 * 1024): Promise<unknown> {
  if (!req.headers.get('content-type')?.includes('application/json'))
    throw new Error('Send JSON content');
  const reader = req.body?.getReader();
  if (!reader) throw new Error('A JSON body is required');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new Error('Request is too large');
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
