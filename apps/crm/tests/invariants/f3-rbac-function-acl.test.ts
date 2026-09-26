import { test, expect, describe, afterAll } from 'vitest';
import { Pool } from 'pg';

const port = process.env.TEST_DB_PORT || '54329';
const dbConfig = {
  connectionString: process.env.DATABASE_URL || `postgres://postgres:postgres@127.0.0.1:${port}/postgres`,
};

const pool = new Pool(dbConfig);

describe('F3 RBAC - Function ACL (SECURITY DEFINER)', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('Public schema functions with SECURITY DEFINER should not be executable by PUBLIC', async () => {
    const hasPublicGrantQuery = `
      SELECT p.proname,
             has_function_privilege('public', p.oid, 'EXECUTE') as public_can_execute,
             has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_can_execute
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prosecdef = true;
    `;

    const r = await pool.query(hasPublicGrantQuery);

    const publicViolations = r.rows.filter(row => row.public_can_execute);
    expect(publicViolations.length, 'No SECURITY DEFINER function should be executable by PUBLIC role').toBe(0);
  });
});
