import { describe, it, expect } from 'vitest';
import { db, getDrizzle } from '../src/drizzle/client';
import * as schema from '../src/drizzle/schema';

describe('Drizzle Bootstrap', () => {
  it('should initialize lazily without throwing errors on import', () => {
    expect(db).toBeDefined();
    expect(schema).toBeDefined();
    expect(schema.organizations).toBeDefined();
    expect(schema.users).toBeUndefined(); // Test that the introspected schema accurately reflects our DB, which uses other naming.
  });

  it('should throw an error when connection configuration is missing', () => {
    // Save original env variables
    const originalEnv = process.env;
    process.env = { ...originalEnv };

    // Unset DB vars
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.DATABASE_URL;

    expect(() => {
      getDrizzle();
    }).toThrow(/Configuration missing/);

    // Restore env
    process.env = originalEnv;
  });
});
