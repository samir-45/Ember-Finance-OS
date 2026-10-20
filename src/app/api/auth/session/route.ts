import {
  authConfigured,
  authenticated,
  createSession,
  readJson,
  sameOrigin,
  sessionCookie,
  verifyPassword,
} from '@/lib/server/auth';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
const attempts = new Map<string, { count: number; until: number }>();
export async function GET(req: Request) {
  return NextResponse.json(
    {
      configured: authConfigured(),
      authenticated: authenticated(req),
      workspaceResetGeneration: process.env.EMBER_WORKSPACE_RESET_GENERATION || null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  if (!authConfigured())
    return NextResponse.json(
      {
        error:
          'Owner sign-in is not configured. Set an owner password of at least 16 characters on the server.',
      },
      { status: 503 },
    );
  // Single owner, process-wide cooldown. Pair with deployment rate limiting for distributed instances.
  const key = 'owner';
  const now = Date.now();
  const attempt = attempts.get(key);
  if (attempt && attempt.until > now && attempt.count >= 10)
    return NextResponse.json(
      { error: 'Too many attempts. Try again in 15 minutes.' },
      { status: 429, headers: { 'Retry-After': '900' } },
    );
  try {
    const body = (await readJson(req, 4096)) as { password?: unknown };
    if (
      typeof body.password !== 'string' ||
      body.password.length > 1024 ||
      !verifyPassword(body.password)
    ) {
      attempts.set(key, {
        count: attempt && attempt.until > now ? attempt.count + 1 : 1,
        until: now + 900000,
      });
      return NextResponse.json({ error: 'Incorrect owner password' }, { status: 401 });
    }
    attempts.delete(key);
    const res = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
    res.cookies.set(sessionCookie(createSession()));
    return res;
  } catch {
    return NextResponse.json({ error: 'Invalid sign-in request' }, { status: 400 });
  }
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  const res = NextResponse.json({ success: true });
  res.cookies.set(sessionCookie('', 0));
  return res;
}
