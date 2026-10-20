import { getDb, isDatabaseConfigured, schema } from '@/lib/db';
import { emptyLedger, validateLedger } from '@/lib/ledger';
import type { LedgerSnapshot } from '@/types';
import { eq, sql } from 'drizzle-orm';
import fs from 'node:fs/promises';
import path from 'node:path';

export class ConflictError extends Error {
  constructor(public revision: number) {
    super('The server ledger changed. Review both copies before replacing either one.');
  }
}
export interface ServerSnapshot {
  revision: number;
  data: LedgerSnapshot;
  provider: 'postgresql' | 'file';
}
const filePath = () => {
  const file = process.env.EMBER_VAULT_PATH;
  if (process.env.EMBER_STORAGE_DRIVER !== 'file' || !file || !path.isAbsolute(file))
    throw new Error(
      'Configure PostgreSQL and run the ledger migration, or explicitly configure a durable file vault.',
    );
  const resolved = path.resolve(file);
  const publicDirectory = path.resolve('public') + path.sep;
  if (resolved.toLowerCase().startsWith(publicDirectory.toLowerCase()))
    throw new Error('The private vault cannot be stored in the public assets directory');
  return file;
};
async function hasLegacyRows(
  db: Pick<NonNullable<ReturnType<typeof getDb>>, 'execute'>,
): Promise<boolean> {
  for (const table of [
    'accounts',
    'transactions',
    'transfers',
    'subscriptions',
    'budgets',
    'goals',
  ]) {
    const exists = await db.execute(sql`select to_regclass(${table}) as name`);
    if (exists.rows[0]?.name) {
      const result = await db.execute(sql.raw(`select exists (select 1 from "${table}") as found`));
      if (result.rows[0]?.found) return true;
    }
  }
  return false;
}
export async function loadSnapshot(): Promise<ServerSnapshot> {
  if (isDatabaseConfigured()) {
    const db = getDb()!;
    const [row] = await db
      .select()
      .from(schema.ledgerSnapshots)
      .where(eq(schema.ledgerSnapshots.id, 'owner'));
    if (!row) {
      if (await hasLegacyRows(db))
        throw new Error(
          'Legacy database records require review and migration before a new ledger can be written.',
        );
    }
    return {
      revision: row?.revision ?? 0,
      data: row ? validateLedger(row.payload) : emptyLedger(),
      provider: 'postgresql',
    };
  }
  const file = filePath();
  try {
    const value = JSON.parse(await fs.readFile(file, 'utf8')) as ServerSnapshot;
    if (!Number.isSafeInteger(value.revision) || value.revision < 1)
      throw new Error('Invalid vault revision');
    return { revision: value.revision, data: validateLedger(value.data), provider: 'file' };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT')
      return { revision: 0, data: emptyLedger(), provider: 'file' };
    throw err;
  }
}
export async function saveSnapshot(
  data: LedgerSnapshot,
  expectedRevision: number,
): Promise<ServerSnapshot> {
  validateLedger(data);
  if (isDatabaseConfigured()) {
    const db = getDb()!;
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(73410291)`);
      const [old] = await tx
        .select()
        .from(schema.ledgerSnapshots)
        .where(eq(schema.ledgerSnapshots.id, 'owner'));
      if (!old && (await hasLegacyRows(tx)))
        throw new Error('Migrate existing records before creating a canonical ledger');
      if ((old?.revision ?? 0) !== expectedRevision) throw new ConflictError(old?.revision ?? 0);
      if (old)
        await tx
          .insert(schema.ledgerHistory)
          .values({ ledgerId: 'owner', revision: old.revision, payload: old.payload })
          .onConflictDoNothing();
      const revision = expectedRevision + 1;
      await tx
        .insert(schema.ledgerSnapshots)
        .values({ id: 'owner', revision, payload: data })
        .onConflictDoUpdate({
          target: schema.ledgerSnapshots.id,
          set: { revision, payload: data, updatedAt: new Date() },
        });
      return { revision, data, provider: 'postgresql' as const };
    });
  }
  const file = filePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  // Exclusive filesystem lock also serializes separate Node processes sharing this vault.
  const lock = await fs.open(file + '.lock', 'wx', 0o600).catch(() => {
    throw new Error('The vault is busy. Retry after the current save finishes.');
  });
  const temporary = file + '.next';
  try {
    const old = await loadSnapshot();
    if (old.revision !== expectedRevision) throw new ConflictError(old.revision);
    if (old.revision > 0)
      await fs
        .copyFile(file, `${file}.revision-${old.revision}.json`, fs.constants.COPYFILE_EXCL)
        .catch((err) => {
          if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
        });
    const next: ServerSnapshot = { revision: expectedRevision + 1, data, provider: 'file' };
    const handle = await fs.open(temporary, 'w', 0o600);
    try {
      await handle.writeFile(JSON.stringify(next));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temporary, file);
    return next;
  } finally {
    await lock.close();
    await fs.unlink(file + '.lock');
  }
}
