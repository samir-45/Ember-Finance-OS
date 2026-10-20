import fs from 'node:fs/promises';
import path from 'node:path';
import { closeDb, getPool } from '../src/lib/db';
import { normalizeLedger } from '../src/lib/ledger';

// Run with node --env-file=.env --import tsx scripts/migrate-ledger.ts.
// DDL is additive. Legacy export and bootstrap require explicit CLI arguments.
async function main() {
  const pool = getPool();
  const args = process.argv.slice(2);
  if (args[0] === '--export-legacy') {
    const output = args[1];
    if (!output) throw new Error('Supply an output JSON path');
    const client = await pool.connect();
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const legacy: Record<string, unknown> = { version: '1.0' };
      for (const [table, key] of Object.entries({
        accounts: 'accounts',
        categories: 'categories',
        transactions: 'transactions',
        transfers: 'transfers',
        subscriptions: 'subscriptions',
        budgets: 'budgets',
        goals: 'goals',
        exchange_rates: 'exchangeRates',
        user_settings: 'settings',
      })) {
        const exists = await client.query('select to_regclass($1) as name', [table]);
        if (!exists.rows[0].name) continue;
        const { rows } = await client.query(`select * from "${table}"`);
        const mapped = rows.map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
              value instanceof Date ? value.toISOString() : value,
            ]),
          ),
        );
        legacy[key] = key === 'settings' ? mapped[0] : mapped;
      }
      await client.query('COMMIT');
      await fs.writeFile(output, JSON.stringify(legacy, null, 2), { flag: 'wx', mode: 0o600 });
      try {
        const valid = normalizeLedger(legacy);
        await fs.writeFile(output + '.validated.json', JSON.stringify(valid, null, 2), {
          flag: 'wx',
          mode: 0o600,
        });
        console.log(
          'Legacy export and validated archive saved. Review unassigned budget months before use.',
        );
      } catch (error) {
        console.log(
          'Raw legacy archive saved without changing the database. Resolve validation issues before restoring:',
        );
        console.log(error instanceof Error ? error.message : 'Validation failed');
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return;
  }
  if (args[0] === '--bootstrap') {
    const file = args[1];
    if (!file) throw new Error('Supply a reviewed, validated JSON archive');
    const data = normalizeLedger(JSON.parse(await fs.readFile(file, 'utf8')));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('select pg_advisory_xact_lock(73410291)');
      const existing = await client.query('select revision from ledger_snapshots where id=$1', [
        'owner',
      ]);
      if (existing.rowCount)
        throw new Error(
          'A canonical ledger already exists. Use revision-checked restore in Settings.',
        );
      await client.query(
        'insert into ledger_snapshots(id,revision,payload) values ($1,1,$2::jsonb)',
        ['owner', JSON.stringify(data)],
      );
      await client.query('COMMIT');
      console.log('Reviewed archive bootstrapped. All legacy tables remain unchanged.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return;
  }
  if (args.length)
    throw new Error('Supported options: --export-legacy PATH or --bootstrap REVIEWED_ARCHIVE');
  const migration = await fs.readFile(path.resolve('drizzle/0001_versioned_ledger.sql'), 'utf8');
  await pool.query(migration);
  console.log('Additive ledger migration applied. Existing records were not rewritten.');
}
main()
  .catch(() => {
    console.error(
      'Migration did not complete. Check database access, migration state, and archive validation. No credentials or financial payloads are logged.',
    );
    process.exitCode = 1;
  })
  .finally(closeDb);
