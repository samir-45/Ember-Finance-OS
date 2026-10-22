import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { readJson, requireOwner } from '@/lib/server/auth';
import { passkeyConfig } from '@/lib/server/passkeys';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const denied = requireOwner(req);
  if (denied) return denied;
  const config = passkeyConfig();
  if (!config) return NextResponse.json({ error: 'Passkeys are not configured.' }, { status: 503 });
  let client;
  try {
    const body = (await readJson(req, 16384)) as {
      response?: RegistrationResponseJSON;
      challengeId?: string;
      name?: string;
    };
    if (!body.response || typeof body.challengeId !== 'string' || typeof body.name !== 'string')
      return NextResponse.json({ error: 'Invalid passkey registration.' }, { status: 400 });
    client = await getPool().connect();
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT challenge, rp_id, origin FROM webauthn_challenges
       WHERE id=$1 AND purpose='registration' AND expires_at > now() FOR UPDATE`,
      [body.challengeId],
    );
    const challenge = rows[0];
    if (!challenge || challenge.rp_id !== config.rpId || challenge.origin !== config.origin) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Registration expired. Please try again.' }, { status: 400 });
    }
    const result = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge as string,
      expectedOrigin: challenge.origin as string,
      expectedRPID: challenge.rp_id as string,
      requireUserVerification: true,
    });
    if (!result.verified || !result.registrationInfo) {
      await client.query('DELETE FROM webauthn_challenges WHERE id=$1', [body.challengeId]);
      await client.query('COMMIT');
      return NextResponse.json({ error: 'Passkey verification failed.' }, { status: 400 });
    }
    const credential = result.registrationInfo.credential;
    await client.query(
      `INSERT INTO owner_passkeys(credential_id,public_key,counter,transports,name)
       VALUES($1,$2,$3,$4,$5)`,
      [
        credential.id,
        Buffer.from(credential.publicKey),
        credential.counter,
        credential.transports ?? [],
        body.name.trim().slice(0, 60) || 'Passkey',
      ],
    );
    await client.query('DELETE FROM webauthn_challenges WHERE id=$1', [body.challengeId]);
    await client.query('COMMIT');
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    await client?.query('ROLLBACK').catch(() => {});
    return NextResponse.json({ error: 'Could not verify this passkey.' }, { status: 400 });
  } finally {
    client?.release();
  }
}
