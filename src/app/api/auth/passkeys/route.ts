import { NextResponse } from 'next/server';
import { requireOwner, readJson, verifyPassword } from '@/lib/server/auth';
import { listPasskeys, passkeyConfig } from '@/lib/server/passkeys';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const denied = requireOwner(req);
  if (denied) return denied;
  if (!passkeyConfig())
    return NextResponse.json({ enabled: false, passkeys: [] }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    return NextResponse.json(
      { enabled: true, passkeys: await listPasskeys() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Could not load passkeys.' }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  const denied = requireOwner(req);
  if (denied) return denied;
  try {
    const body = (await readJson(req, 4096)) as { id?: unknown; password?: unknown };
    if (typeof body.id !== 'string' || typeof body.password !== 'string')
      return NextResponse.json({ error: 'Confirm your owner password to remove a passkey.' }, { status: 400 });
    if (!verifyPassword(body.password))
      return NextResponse.json({ error: 'Incorrect owner password.' }, { status: 401 });
    const result = await getPool().query('DELETE FROM owner_passkeys WHERE credential_id=$1', [body.id]);
    if (!result.rowCount) return NextResponse.json({ error: 'Passkey was not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not remove this passkey.' }, { status: 400 });
  }
}
