import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * Lazy-initialized Drizzle client.
 * Connects to the database only when explicitly accessed or a query is made.
 */

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _pool: Pool | null = null;

export function getDrizzle() {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;

  if (!url) {
    if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD) {
       // fallback mapped fields
       const pool = new Pool({
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT || '5432', 10),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME || 'lumenva',
       });
       _pool = pool;
       _db = drizzle(pool, { schema });
       return _db;
    }
    throw new Error('Drizzle connection failed: Configuration missing. Ensure DATABASE_URL or DB_* vars are set.');
  }

  const pool = new Pool({ connectionString: url });
  _pool = pool;
  _db = drizzle(pool, { schema });

  return _db;
}

/**
 * Singleton proxy to allow `db.query...` usage seamlessly while maintaining lazy evaluation.
 */
export const db = new Proxy({} as ReturnType<typeof getDrizzle>, {
  get(target, prop) {
    const dbInstance = getDrizzle();
    const value = Reflect.get(dbInstance, prop);
    return typeof value === 'function' ? value.bind(dbInstance) : value;
  }
});
