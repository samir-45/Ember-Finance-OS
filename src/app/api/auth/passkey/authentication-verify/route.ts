import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, WebAuthnCredential } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { createSession, sameOrigin, sessionCookie, readJson } from '@/lib/server/auth';
import { passkeyConfig } from '@/lib/server/passkeys';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  const config = passkeyConfig();
  if (!config) return NextResponse.json({ error: 'Passkeys are not configured.' }, { status: 503 });
  let client;
  try {
    const body = (await readJson(req, 16384)) as {
      response?: AuthenticationResponseJSON;
      challengeId?: string;
    };
    if (!body.response || typeof body.challengeId !== 'string')
      return NextResponse.json({ error: 'Invalid passkey sign-in.' }, { status: 400 });
    client = await getPool().connect();
    await client.query('BEGIN');
    const { rows: challengeRows } = await client.query(
      `SELECT challenge, rp_id, origin FROM webauthn_challenges
       WHERE id=$1 AND purpose='authentication' AND expires_at > now() FOR UPDATE`,
      [body.challengeId],
    );
    const challenge = challengeRows[0];
    if (!challenge || challenge.rp_id !== config.rpId || challenge.origin !== config.origin) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Sign-in expired. Please try again.' }, { status: 400 });
    }
    const { rows: credentialRows } = await client.query(
      'SELECT credential_id,public_key,counter,transports FROM owner_passkeys WHERE credential_id=$1 FOR UPDATE',
      [body.response.id],
    );
    const stored = credentialRows[0];
    if (!stored) {
      await client.query('DELETE FROM webauthn_challenges WHERE id=$1', [body.challengeId]);
      await client.query('COMMIT');
      return NextResponse.json({ error: 'Passkey not recognized. Use your owner password.' }, { status: 401 });
    }
    const credential: WebAuthnCredential = {
      id: stored.credential_id as string,
      publicKey: new Uint8Array(stored.public_key as Buffer),
      counter: Number(stored.counter),
      transports: stored.transports as string[],
    };
    const result = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge as string,
      expectedOrigin: challenge.origin as string,
      expectedRPID: challenge.rp_id as string,
      credential,
      requireUserVerification: true,
    });
    if (!result.verified || !result.authenticationInfo.userVerified) {
      await client.query('DELETE FROM webauthn_challenges WHERE id=$1', [body.challengeId]);
      await client.query('COMMIT');
      return NextResponse.json({ error: 'Passkey verification failed.' }, { status: 401 });
    }
    await client.query(
      'UPDATE owner_passkeys SET counter=$2,last_used_at=now() WHERE credential_id=$1',
      [credential.id, result.authenticationInfo.newCounter],
    );
    await client.query('DELETE FROM webauthn_challenges WHERE id=$1', [body.challengeId]);
    await client.query('COMMIT');
    const res = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
    res.cookies.set(sessionCookie(createSession()));
    return res;
  } catch {
    await client?.query('ROLLBACK').catch(() => {});
    return NextResponse.json({ error: 'Could not verify this passkey. Use your owner password if needed.' }, { status: 401 });
  } finally {
    client?.release();
  }
}
