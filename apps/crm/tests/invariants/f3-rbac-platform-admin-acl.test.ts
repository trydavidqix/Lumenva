import { test, expect, describe, afterAll } from 'vitest';
import { Pool } from 'pg';

const port = process.env.TEST_DB_PORT || '54329';
const dbConfig = {
  connectionString: process.env.DATABASE_URL || `postgres://postgres:postgres@127.0.0.1:${port}/postgres`,
};

const pool = new Pool(dbConfig);

describe('F3 RBAC - platform_admins ACL', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('platform_admins should only be modifiable by postgres (DBA)', async () => {
    const r = await pool.query(`
      SELECT grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'platform_admins'
        AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
        AND grantee != 'postgres' AND grantee != 'supabase_admin';
    `);

    expect(r.rows.length, 'No one except DBA should be able to mutate platform_admins').toBe(0);
  });
});
