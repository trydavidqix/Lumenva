/**
 * LangGraph PostgreSQL checkpointer factory for proposal workflow state persistence.
 *
 * The checkpointer is responsible for persisting graph state across interrupt/resume
 * cycles. This factory creates a PostgresSaver configured to use the `langgraph_internal`
 * schema (created by Task 3 migration). The checkpointer is NOT called with `.setup()`
 * at runtime — the migration has already created the required tables.
 *
 * Multi-tenancy: `threadId` is scoped to `organization_id` via the workflow run table
 * (`ai_workflow_runs.unique(organization_id, thread_id)`), which provides the tenant
 * boundary. The checkpointer itself is agnostic to organization, but a graph must never
 * be resumed with a thread_id from a different organization.
 */
import type { BaseCheckpointSaver } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type pg from 'pg';

/**
 * Create a checkpointer for proposal workflow state persistence.
 *
 * @param pool - pg.Pool connected to the CRM database
 * @returns PostgresSaver configured for the `langgraph_internal` schema
 *
 * Caller is responsible for thread_id/organization_id validation:
 * - thread_id must be UUID v4
 * - thread_id must be scoped to the caller's organization_id
 * - Never resume a workflow with a thread_id from a different organization
 */
export function createCheckpointerForProposalWorkflow(pool: pg.Pool): BaseCheckpointSaver {
  return new PostgresSaver(pool, undefined, {
    schema: 'langgraph_internal',
  });
}
