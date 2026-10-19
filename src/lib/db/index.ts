import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return Boolean(url && url.length > 15 && !url.includes('placeholder'));
}

export function getDb() {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (!dbInstance) {
    const connectionString = process.env.DATABASE_URL!;
    pool = new Pool({ connectionString });
    dbInstance = drizzle(pool, { schema });
  }

  return dbInstance;
}

export { schema };
