import { randomUUID } from 'node:crypto';
import { isDatabaseConfigured, getPool } from '@/lib/db';

export type PasskeyConfig = { rpId: string; origin: string };

export function passkeyConfig(): PasskeyConfig | null {
  if (!isDatabaseConfigured() || !process.env.EMBER_PUBLIC_URL) return null;
  try {
    const url = new URL(process.env.EMBER_PUBLIC_URL);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1')
      return null;
    const rpId = process.env.EMBER_WEBAUTHN_RP_ID || url.hostname;
    if (url.hostname !== rpId && !url.hostname.endsWith(`.${rpId}`)) return null;
    return { rpId, origin: url.origin };
  } catch {
    return null;
  }
}

export async function createChallenge(
  purpose: 'registration' | 'authentication',
  challenge: string,
  config: PasskeyConfig,
): Promise<string> {
  const id = randomUUID();
  await getPool().query('DELETE FROM webauthn_challenges WHERE expires_at <= now()');
  await getPool().query(
    `INSERT INTO webauthn_challenges(id,purpose,challenge,rp_id,origin,expires_at)
     VALUES($1,$2,$3,$4,$5,now() + interval '5 minutes')`,
    [id, purpose, challenge, config.rpId, config.origin],
  );
  return id;
}

export async function listPasskeys() {
  const { rows } = await getPool().query(
    'SELECT credential_id, name, created_at, last_used_at FROM owner_passkeys ORDER BY created_at',
  );
  return rows.map((row) => ({
    id: row.credential_id as string,
    name: row.name as string,
    createdAt: (row.created_at as Date).toISOString(),
    lastUsedAt: row.last_used_at ? (row.last_used_at as Date).toISOString() : null,
  }));
}
