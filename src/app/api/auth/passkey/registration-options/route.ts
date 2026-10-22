import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { readJson, requireOwner, verifyPassword } from '@/lib/server/auth';
import { createChallenge, passkeyConfig } from '@/lib/server/passkeys';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const denied = requireOwner(req);
  if (denied) return denied;
  const config = passkeyConfig();
  if (!config)
    return NextResponse.json(
      { error: 'Passkeys need PostgreSQL and the canonical HTTPS origin in EMBER_PUBLIC_URL.' },
      { status: 503 },
    );
  try {
    const body = (await readJson(req, 4096)) as { password?: unknown; name?: unknown };
    if (typeof body.password !== 'string' || !verifyPassword(body.password))
      return NextResponse.json({ error: 'Confirm your owner password to add a passkey.' }, { status: 401 });
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : '';
    if (!name) return NextResponse.json({ error: 'Give this passkey a device name.' }, { status: 400 });
    const { rows } = await getPool().query(
      'SELECT credential_id, transports FROM owner_passkeys ORDER BY created_at',
    );
    const options = await generateRegistrationOptions({
      rpName: 'Ember Finance',
      rpID: config.rpId,
      userID: Buffer.from('ember-owner'),
      userName: 'owner',
      userDisplayName: 'Ember owner',
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
      excludeCredentials: rows.map((row) => ({
        id: row.credential_id as string,
        transports: row.transports as string[],
      })),
    });
    const challengeId = await createChallenge('registration', options.challenge, config);
    return NextResponse.json({ options, challengeId, name }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not start passkey registration.' }, { status: 400 });
  }
}
