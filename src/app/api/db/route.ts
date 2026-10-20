import { ledgerSchema, validateLedger } from '@/lib/ledger';
import { readJson, requireOwner } from '@/lib/server/auth';
import { ConflictError, loadSnapshot, saveSnapshot } from '@/lib/server/persistence';
import { NextResponse } from 'next/server';
import { z } from 'zod';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const input = z.object({
  expectedRevision: z.number().int().safe().nonnegative(),
  data: ledgerSchema,
});
const headers = { 'Cache-Control': 'no-store' };
export async function GET(req: Request) {
  const denied = requireOwner(req);
  if (denied) return denied;
  try {
    const snapshot = await loadSnapshot();
    return NextResponse.json(
      { success: true, exists: snapshot.revision > 0, ...snapshot },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          'Server ledger unavailable. Check storage configuration and migrations. Your browser copy is unchanged.',
      },
      { status: 503, headers },
    );
  }
}
export async function POST(req: Request) {
  const denied = requireOwner(req);
  if (denied) return denied;
  let body: z.infer<typeof input>;
  try {
    body = input.parse(await readJson(req));
  } catch {
    return NextResponse.json(
      { error: 'Invalid ledger. Check amounts, dates, currencies, references, and request size.' },
      { status: 400, headers },
    );
  }
  try {
    const saved = await saveSnapshot(validateLedger(body.data), body.expectedRevision);
    return NextResponse.json(
      { success: true, revision: saved.revision, provider: saved.provider },
      { headers },
    );
  } catch (err) {
    if (err instanceof ConflictError)
      return NextResponse.json(
        { error: err.message, revision: err.revision },
        { status: 409, headers },
      );
    return NextResponse.json(
      {
        error:
          'Save failed. No fallback was used. Keep your browser copy and retry after checking the server.',
      },
      { status: 503, headers },
    );
  }
}
// Clearing the current ledger uses the same versioned POST path. History is retained.
export async function DELETE(req: Request) {
  const denied = requireOwner(req);
  if (denied) return denied;
  return NextResponse.json(
    { error: 'Use a revision-checked empty ledger save from Settings.' },
    { status: 405, headers },
  );
}
