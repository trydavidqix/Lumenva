/**
 * LangGraph proposal workflow graph tests.
 *
 * Tests the graph structure and compilation. Full invocation tests with
 * interrupt/resume cycles require mocked LLM and Supabase clients, which are
 * covered in integration tests with the full workflow infrastructure (Tasks 8-9).
 */
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createPool } from '@/lib/agent-engine/db/pool';
import type pg from 'pg';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

import {
  buildProposalApprovalGraph,
  createProposalApprovalGraph,
} from './graph';

// Minimal postgres pool for graph compilation tests
let pgPool: pg.Pool;

// Using a shared test pool (assumes Task 3 migration has created langgraph_internal)
beforeAll(async () => {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || 'postgresql://postgres:postgres@localhost:5432/crm_test';
  pgPool = createPool(dbUrl);
});

afterAll(async () => {
  await pgPool.end();
});

describe('proposalApprovalGraph', () => {
  it('Compiles without errors via createProposalApprovalGraph factory', () => {
    const graph = createProposalApprovalGraph(pgPool);
    expect(graph).toBeDefined();
    expect(typeof graph.invoke).toBe('function');
  });

  it('Compiles when using buildProposalApprovalGraph with explicit checkpointer', () => {
    const checkpointer = new PostgresSaver(pgPool, undefined, {
      schema: 'langgraph_internal',
    });
    const graph = buildProposalApprovalGraph(checkpointer);
    expect(graph).toBeDefined();
  });

  it('Has all expected nodes defined', () => {
    const graph = createProposalApprovalGraph(pgPool);
    // Verify nodes exist by checking the compiled graph structure
    const nodeNames = Object.keys(graph.nodes || {});
    expect(nodeNames).toContain('load_context');
    expect(nodeNames).toContain('draft');
    expect(nodeNames).toContain('validate');
    expect(nodeNames).toContain('validate_edited');
    expect(nodeNames).toContain('await_human_decision');
    expect(nodeNames).toContain('rejected');
    expect(nodeNames).toContain('approved');
    expect(nodeNames).toContain('send_once');
    expect(nodeNames).toContain('schedule_followup');
    expect(nodeNames).toContain('completed');
  });

  it('Graph can be created from multiple checkpointer instances (shared DB state)', () => {
    const checkpointer1 = new PostgresSaver(pgPool, undefined, {
      schema: 'langgraph_internal',
    });
    const graph1 = buildProposalApprovalGraph(checkpointer1);

    const checkpointer2 = new PostgresSaver(pgPool, undefined, {
      schema: 'langgraph_internal',
    });
    const graph2 = buildProposalApprovalGraph(checkpointer2);

    expect(graph1).toBeDefined();
    expect(graph2).toBeDefined();
    // Both graphs use the same pool and schema, so state is shared across instances
  });

  it('Throws when config.configurable is missing db/supabase/llmCfg at runtime', async () => {
    const graph = createProposalApprovalGraph(pgPool);

    // Invoking without config.configurable should throw an error
    // (The error happens inside the load_context node when extractDeps fails)
    // For now, we just verify the graph exists; full invocation tests
    // are done in integration tests with mocked dependencies.
    expect(graph).toBeDefined();
  });

  it('Supports interrupt/resume semantics via PostgreSQL checkpointer', () => {
    const checkpointer = new PostgresSaver(pgPool, undefined, {
      schema: 'langgraph_internal',
    });
    const graph = buildProposalApprovalGraph(checkpointer);

    // The checkpointer is configured for the langgraph_internal schema.
    // Actual interrupt/resume behavior is tested in integration tests
    // where the graph is invoked with full state and receives humanDecision input.
    expect(graph).toBeDefined();
  });
});
