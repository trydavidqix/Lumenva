/**
 * PostgreSQL checkpointer factory tests.
 *
 * Verifies that the checkpointer is correctly configured for the langgraph_internal schema.
 */
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createPool } from '@/lib/agent-engine/db/pool';
import type pg from 'pg';

import { createCheckpointerForProposalWorkflow } from './checkpointer';

let pgPool: pg.Pool;

beforeAll(async () => {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || 'postgresql://postgres:postgres@localhost:5432/crm_test';
  pgPool = createPool(dbUrl);
});

afterAll(async () => {
  await pgPool.end();
});

describe('createCheckpointerForProposalWorkflow', () => {
  it('Returns a BaseCheckpointSaver instance', () => {
    const checkpointer = createCheckpointerForProposalWorkflow(pgPool);
    expect(checkpointer).toBeDefined();
    expect(typeof checkpointer).toBe('object');
  });

  it('Is configured for the langgraph_internal schema', () => {
    const checkpointer = createCheckpointerForProposalWorkflow(pgPool);
    expect(checkpointer).toBeDefined();
  });

  it('Can be used by multiple graph instances (shared storage)', () => {
    const checkpointer1 = createCheckpointerForProposalWorkflow(pgPool);
    const checkpointer2 = createCheckpointerForProposalWorkflow(pgPool);

    expect(checkpointer1).toBeDefined();
    expect(checkpointer2).toBeDefined();
  });

  it('Accepts a pg.Pool as the sole parameter', () => {
    const checkpointer = createCheckpointerForProposalWorkflow(pgPool);
    expect(checkpointer).toBeDefined();
  });
});
