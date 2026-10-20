import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { closeDb, getPool } from '../src/lib/db';
import { emptyLedger } from '../src/lib/ledger';
import { loadSnapshot, saveSnapshot } from '../src/lib/server/persistence';

test(
  'PostgreSQL migration, atomic conflict handling, complete snapshots, and retained revisions',
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const pool = getPool();
    try {
      // TEST_DATABASE_URL must name a disposable database, never production.
      assert.match(
        new URL(process.env.TEST_DATABASE_URL!).pathname,
        /test/i,
        'Use a database with test in its name',
      );
      await pool.query(await fs.readFile('drizzle/0001_versioned_ledger.sql', 'utf8'));
      const before = await loadSnapshot();
      const a = emptyLedger();
      a.settings.givingPercent = 10;
      const first = await saveSnapshot(a, before.revision);
      assert.equal(first.revision, before.revision + 1);
      const b = emptyLedger();
      b.settings.givingPercent = 20;
      const writes = await Promise.allSettled([
        saveSnapshot(a, first.revision),
        saveSnapshot(b, first.revision),
      ]);
      assert.equal(writes.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(writes.filter((r) => r.status === 'rejected').length, 1);
      const current = await loadSnapshot();
      assert.equal(current.revision, first.revision + 1);
      assert.ok([10, 20].includes(current.data.settings.givingPercent!));
      const history = await pool.query(
        'select count(*)::int as count from ledger_history where ledger_id=$1',
        ['owner'],
      );
      assert.ok(history.rows[0].count >= 1);
      const invalid = { ...emptyLedger(), accounts: [{ id: 'broken' }] };
      await assert.rejects(() => saveSnapshot(invalid as never, current.revision));
      assert.equal((await loadSnapshot()).revision, current.revision);
    } finally {
      await closeDb();
    }
  },
);
