import EmbeddedPostgres from '../verification/pg-tools/node_modules/embedded-postgres/dist/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const root = path.resolve('artifacts/verification');
const databaseDir = await fs.mkdtemp(path.join(root, 'pg-cluster-'));
if (!databaseDir.startsWith(root + path.sep)) throw new Error('Unexpected database directory');
const socket = net.createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve)); const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const password = randomBytes(24).toString('hex');
const postgres = new EmbeddedPostgres({ databaseDir, user: 'postgres', password, port, persistent: true, createPostgresUser: false, initdbFlags: ['--locale=C', '--encoding=UTF8'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: message => { if (String(message).includes('FATAL')) console.error('Disposable PostgreSQL process reported a fatal error'); } });
let started = false;
try {
  await postgres.initialise(); await postgres.start(); started = true; await postgres.createDatabase('ember_test');
  const child = spawn(process.execPath, ['--import', 'tsx', '--test', 'tests/postgres.test.ts'], { stdio: 'inherit', env: { ...process.env, TEST_DATABASE_URL: `postgres://postgres:${password}@127.0.0.1:${port}/ember_test` } });
  const code = await new Promise(resolve => child.on('exit', resolve)); if (code) process.exitCode = Number(code);
} finally {
  if (started) await postgres.stop();
  const resolved = path.resolve(databaseDir); if (resolved.startsWith(root + path.sep) && path.basename(resolved).startsWith('pg-cluster-')) await fs.rm(resolved, { recursive: true, force: true });
}
