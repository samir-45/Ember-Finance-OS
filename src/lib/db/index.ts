import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
let pool: Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
export function isDatabaseConfigured(): boolean {
  const value = process.env.DATABASE_URL;
  return Boolean(value && /^postgres(ql)?:\/\//.test(value) && !value.includes('placeholder'));
}
export function getPool(): Pool {
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL is not configured');
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL!);
    const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
    // Keep TLS verification enabled for remote databases. Connection-string SSL
    // flags must not override this setting or disable certificate verification.
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
    pool = new Pool({
      connectionString: url.toString(),
      ssl: local ? false : { rejectUnauthorized: true },
      enableChannelBinding: true,
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });
    pool.on('error', () => {
      console.error('Database pool connection interrupted');
    });
  }
  return pool;
}
export function getDb() {
  if (!isDatabaseConfigured()) return null;
  if (!db) db = drizzle(getPool(), { schema });
  return db;
}
export async function closeDb() {
  await pool?.end();
  pool = null;
  db = null;
}
export { schema };
