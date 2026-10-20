import EmbeddedPostgres from '../verification/pg-tools/node_modules/embedded-postgres/dist/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import pg from 'pg';

const root = path.resolve('artifacts/verification');
const directory = await fs.mkdtemp(path.join(root, 'reset-check-'));
const socket = net.createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const password = randomBytes(24).toString('hex');
const postgres = new EmbeddedPostgres({ databaseDir: path.join(directory, 'cluster'), user: 'postgres', password, port, persistent: true, createPostgresUser: false, initdbFlags: ['--locale=C', '--encoding=UTF8'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
let started = false;
let client;
try {
  await postgres.initialise();
  await postgres.start(); started = true;
  await postgres.createDatabase('ember_reset_test');
  const url = `postgres://postgres:${password}@127.0.0.1:${port}/ember_reset_test`;
  client = new pg.Client({ connectionString: url });
  await client.connect();
  const migration = await fs.readFile('drizzle/0001_versioned_ledger.sql', 'utf8');
  await client.query(migration);
  await client.query('create table accounts (id text primary key); insert into accounts values (\'test-account\'); create table transactions (id text primary key); insert into transactions values (\'test-transaction\');');
  await client.query('insert into ledger_snapshots (id, revision, payload) values ($1,$2,$3); insert into ledger_history (ledger_id, revision, payload) values ($1,$2,$3)', ['owner', 7, JSON.stringify({version:2})]).catch(async () => {
    await client.query('insert into ledger_snapshots (id, revision, payload) values ($1,$2,$3)', ['owner', 7, JSON.stringify({version:2})]);
    await client.query('insert into ledger_history (ledger_id, revision, payload) values ($1,$2,$3)', ['owner', 7, JSON.stringify({version:2})]);
  });
  const workspace = path.join(directory, 'workspace');
  await fs.mkdir(path.join(workspace, 'drizzle'), { recursive: true });
  await fs.mkdir(path.join(workspace, '.data'));
  await fs.writeFile(path.join(workspace, 'drizzle/0001_versioned_ledger.sql'), migration);
  await fs.writeFile(path.join(workspace, '.data/ember_vault.json'), '{"old":"fixture"}');
  await fs.writeFile(path.join(workspace, '.env'), 'UNRELATED_SETTING=preserved\n');
  const child = spawn(process.execPath, ['--import', pathToFileURL(path.resolve('node_modules/tsx/dist/loader.mjs')).href, path.resolve('scripts/reset-data.ts'), '--confirm-erase-all'], { cwd: workspace, stdio: 'inherit', env: {...process.env, DATABASE_URL: url, EMBER_VAULT_PATH: ''} });
  assert.equal(await new Promise(resolve => child.on('exit', resolve)), 0);
  const snapshot = (await client.query('select revision,payload from ledger_snapshots')).rows;
  assert.equal(snapshot.length, 1);
  assert.equal(Number(snapshot[0].revision), 8);
  assert.deepEqual(snapshot[0].payload.accounts, []);
  assert.deepEqual(snapshot[0].payload.transactions, []);
  for (const table of ['accounts', 'transactions', 'ledger_history']) assert.equal((await client.query(`select count(*)::int as count from ${table}`)).rows[0].count, 0);
  assert.equal(await fs.access(path.join(workspace,'.data/ember_vault.json')).then(() => true, () => false), false);
  const env = await fs.readFile(path.join(workspace,'.env'),'utf8');
  assert.match(env, /UNRELATED_SETTING=preserved/);
  assert.match(env, /EMBER_WORKSPACE_RESET_GENERATION=[a-f0-9-]{36}/);
  console.log('PASS: reset cleared rows/history/vault, retained schema, advanced revision, scheduled browser cleanup, and preserved unrelated settings.');
} finally {
  await client?.end();
  if (started) await postgres.stop();
  const resolved = path.resolve(directory);
  if (resolved.startsWith(root + path.sep) && path.basename(resolved).startsWith('reset-check-')) await fs.rm(resolved, { recursive: true, force: true });
}
