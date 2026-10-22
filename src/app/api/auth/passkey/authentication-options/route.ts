import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { sameOrigin } from '@/lib/server/auth';
import { createChallenge, passkeyConfig } from '@/lib/server/passkeys';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';
const attempts = new Map<string, { count: number; until: number }>();

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  const now = Date.now();
  const attempt = attempts.get('owner');
  if (attempt && attempt.until > now && attempt.count >= 10)
    return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  attempts.set('owner', {
    count: attempt && attempt.until > now ? attempt.count + 1 : 1,
    until: now + 900000,
  });
  const config = passkeyConfig();
  if (!config) return NextResponse.json({ error: 'Passkeys are not configured.' }, { status: 503 });
  try {
    const { rows } = await getPool().query(
      'SELECT credential_id, transports FROM owner_passkeys ORDER BY created_at',
    );
    if (!rows.length)
      return NextResponse.json({ error: 'No passkeys are registered. Sign in with your password.' }, { status: 404 });
    const options = await generateAuthenticationOptions({
      rpID: config.rpId,
      allowCredentials: rows.map((row) => ({
        id: row.credential_id as string,
        transports: row.transports as string[],
      })),
      userVerification: 'required',
    });
    const challengeId = await createChallenge('authentication', options.challenge, config);
    return NextResponse.json({ options, challengeId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not start passkey sign-in.' }, { status: 503 });
  }
}
