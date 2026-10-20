import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { closeDb, getPool, isDatabaseConfigured } from '../src/lib/db';
import { emptyLedger } from '../src/lib/ledger';

const applicationTables = [
  'ledger_snapshots',
  'ledger_history',
  'accounts',
  'categories',
  'transactions',
  'transfers',
  'subscriptions',
  'budgets',
  'goals',
  'exchange_rates',
  'coach_insights',
  'user_settings',
  'allocations',
  'reconciliations',
];

async function main() {
  const inspect = process.argv.includes('--inspect');
  if (!inspect && !process.argv.includes('--confirm-erase-all'))
    throw new Error(
      'Pass --inspect or --confirm-erase-all. Erasure includes retained ledger history.',
    );
  if (isDatabaseConfigured()) {
    const client = await getPool().connect();
    try {
      const { rows } = await client.query<{ table_name: string }>(
        "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name",
      );
      const tables = rows
        .map((row) => row.table_name)
        .filter((name) => applicationTables.includes(name));
      const counts: Record<string, number> = {};
      for (const table of tables) {
        const result = await client.query(`select count(*)::int as count from public."${table}"`);
        counts[table] = result.rows[0].count;
      }
      console.log(JSON.stringify({ provider: 'postgresql', applicationRowCounts: counts }));
      if (!inspect) {
        await client.query('BEGIN');
        try {
          await client.query('select pg_advisory_xact_lock(73410291)');
          await client.query('SET LOCAL search_path TO public');
          let revision = 1;
          if (tables.includes('ledger_snapshots')) {
            const old = await client.query(
              "select revision from public.ledger_snapshots where id = 'owner' for update",
            );
            revision = Number(old.rows[0]?.revision ?? 0) + 1;
            if (!Number.isSafeInteger(revision)) throw new Error('Unsupported next revision');
          }
          if (tables.length)
            await client.query(
              `TRUNCATE TABLE ${tables.map((table) => `public."${table}"`).join(', ')} RESTART IDENTITY`,
            );
          const migration = (
            await fs.readFile(path.resolve('drizzle/0001_versioned_ledger.sql'), 'utf8')
          )
            .split(/\r?\n/)
            .filter((line) => !['BEGIN;', 'COMMIT;'].includes(line.trim().toUpperCase()))
            .join('\n');
          await client.query(migration);
          await client.query(
            'insert into public.ledger_snapshots (id, revision, payload) values ($1, $2, $3::jsonb)',
            ['owner', revision, JSON.stringify(emptyLedger())],
          );
          for (const table of tables.filter((name) => name !== 'ledger_snapshots')) {
            const result = await client.query(
              `select count(*)::int as count from public."${table}"`,
            );
            if (result.rows[0].count !== 0) throw new Error('Erasure verification failed');
          }
          await client.query('COMMIT');
          console.log(
            JSON.stringify({
              databaseCleared: true,
              emptyLedgerRevision: revision,
              historyRows: 0,
            }),
          );
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
    } finally {
      client.release();
    }
  } else console.log(JSON.stringify({ databaseConfigured: false }));
  if (inspect) return;

  // Delete only explicit Ember vault files, never their containing directories.
  const vaults = [path.resolve('.data/ember_vault.json')];
  if (process.env.EMBER_VAULT_PATH) {
    if (!path.isAbsolute(process.env.EMBER_VAULT_PATH))
      throw new Error('Vault path must be absolute');
    vaults.push(path.resolve(process.env.EMBER_VAULT_PATH));
  }
  let filesRemoved = 0;
  for (const vault of new Set(vaults)) {
    const directory = path.dirname(vault);
    const name = path.basename(vault);
    const names = await fs.readdir(directory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    for (const candidate of names) {
      if (
        candidate !== name &&
        candidate !== `${name}.next` &&
        !new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.revision-\\d+\\.json$`).test(
          candidate,
        )
      )
        continue;
      await fs.unlink(path.join(directory, candidate));
      filesRemoved++;
    }
  }
  const envPath = path.resolve('.env');
  const original = await fs.readFile(envPath, 'utf8');
  const generation = randomUUID();
  const line = `EMBER_WORKSPACE_RESET_GENERATION=${generation}`;
  const next = /^EMBER_WORKSPACE_RESET_GENERATION=.*$/m.test(original)
    ? original.replace(/^EMBER_WORKSPACE_RESET_GENERATION=.*$/m, line)
    : `${original.trimEnd()}\n\n# Owner-authorized fresh start; each browser clears Ember storage once.\n${line}\n`;
  await fs.writeFile(envPath, next, { mode: 0o600 });
  console.log(JSON.stringify({ vaultFilesRemoved: filesRemoved, browserResetScheduled: true }));
}
void main()
  .catch(() => {
    console.error('Data reset did not complete. No credentials or financial records are logged.');
    process.exitCode = 1;
  })
  .finally(() => closeDb());
