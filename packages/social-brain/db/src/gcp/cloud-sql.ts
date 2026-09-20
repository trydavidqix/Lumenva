import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

/**
 * Cloud SQL (PostgreSQL) Adapter for Lumenva Data Core.
 * Replaces Supabase DB connection.
 */

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'lumenva',
  // Use ssl for Cloud SQL connections outside of Cloud Run if not using IAM Auth proxy
  // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool);

export async function connectCloudSQL() {
  const client = await pool.connect();
  try {
    console.log('Successfully connected to Cloud SQL database');
  } finally {
    client.release();
  }
}
