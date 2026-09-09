/**
 * Idempotent follow-up scheduling — Task 1 (Phase 8) Steps 1-2: real impl.
 *
 * Architecture:
 * - Idempotency marker: `ai_workflow_runs.followup_id` (FK to
 *   `followup_enrollments.id`, per migration 0119).
 * - First call: enrolls the contact into the org's configured follow-up flow,
 *   records `followup_id`.
 * - Resume/retry: `followup_id` already set → short-circuit, `duplicate: true`.
 * - Only schedules if the send succeeded (`sent_message_id` populated) —
 *   rejected/never-sent workflows skip follow-up entirely.
 * - Which flow to enroll into is CONFIG, not an invented default: read from
 *   `ai_platform_feature_flags.config.followup_pointer_id` for the
 *   `langgraph_proposal_workflow` feature (tenant row wins, org-wide/global
 *   row is the fallback — same precedence `resolveFeatureRows` already uses).
 *   An org with no configured pointer legitimately has no automated
 *   post-proposal follow-up yet; this skips rather than guessing a flow
 *   (`.claude/rules/data-modeling.md` DIRC — no undeclared business default).
 * - Reuses the exact enrollment shape `POST /api/v1/ai/followups/enrollments`
 *   already writes (pointer must be `active` with a published version whose
 *   graph has a `trigger` node) — no second enrollment code path/schema.
 */
import type pg from 'pg';

import { flowGraphSchema } from '@/lib/followup/graph-schema';
import type { ProposalGraphState } from '@/lib/workflows/commercial-proposal-graph';

export interface ScheduleFollowupOnceResult {
  followupId: string | null;
  duplicate: boolean;
  /** true if the send never happened (rejected/blocked/failed) or no follow-up flow is configured. */
  skipped: boolean;
}

/** Extends the base graph state with the trusted DB row id — see graph.ts's `workflow_run_id` field. */
export interface ProposalFollowupNodeState extends ProposalGraphState {
  workflow_run_id: string;
}

interface WorkflowRunRow {
  organization_id: string;
  status: string;
  sent_message_id: string | null;
  followup_id: string | null;
  contact_id: string;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === '23505';
}

/** Reads `ai_platform_feature_flags.config.followup_pointer_id` — tenant row wins over the org-wide/global row. */
async function resolveFollowupPointerId(db: pg.Pool, organizationId: string): Promise<string | null> {
  const { rows } = await db.query<{ config: unknown }>(
    `select config from ai_platform_feature_flags
     where feature = 'langgraph_proposal_workflow'
       and (organization_id = $1 or organization_id is null)
     order by organization_id nulls last
     limit 1`,
    [organizationId],
  );
  const config = rows[0]?.config;
  if (config && typeof config === 'object' && !Array.isArray(config)) {
    const value = (config as Record<string, unknown>).followup_pointer_id;
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

/**
 * Schedules the post-proposal follow-up EXACTLY ONCE for a given workflow run.
 *
 * - `followup_id` already set → short-circuit, `duplicate: true`.
 * - `status === 'rejected'` or `sent_message_id` null → `skipped: true`
 *   (nothing was ever sent, nothing to follow up on).
 * - No configured/active/publishable follow-up pointer for the org →
 *   `skipped: true` (no invented default flow).
 * - Contact already has a live enrollment on that pointer (the flow engine's
 *   own `idx_followup_enrollments_one_live` unique index) → `skipped: true`
 *   rather than duplicating/stealing an enrollment this workflow doesn't own.
 * - org mismatch / missing row → throws (invariant violation).
 */
export async function scheduleFollowupOnce(
  workflowRunId: string,
  organizationId: string,
  db: pg.Pool,
): Promise<ScheduleFollowupOnceResult> {
  const { rows } = await db.query<WorkflowRunRow>(
    `select organization_id, status, sent_message_id, followup_id, contact_id
     from ai_workflow_runs where id = $1`,
    [workflowRunId],
  );
  const run = rows[0];
  if (!run) {
    throw new Error(`scheduleFollowupOnce: ai_workflow_runs not found: ${workflowRunId}`);
  }
  if (run.organization_id !== organizationId) {
    throw new Error(`scheduleFollowupOnce: organization mismatch for workflow run ${workflowRunId}`);
  }
  if (run.followup_id) {
    return { followupId: run.followup_id, duplicate: true, skipped: false };
  }
  if (run.status === 'rejected' || !run.sent_message_id) {
    return { followupId: null, duplicate: false, skipped: true };
  }

  const pointerId = await resolveFollowupPointerId(db, organizationId);
  if (!pointerId) {
    return { followupId: null, duplicate: false, skipped: true };
  }

  const { rows: pointerRows } = await db.query<{ id: string; status: string; active_version_id: string | null }>(
    `select id, status, active_version_id from followup_flow_pointers where id = $1 and organization_id = $2`,
    [pointerId, organizationId],
  );
  const pointer = pointerRows[0];
  if (!pointer || pointer.status !== 'active' || !pointer.active_version_id) {
    return { followupId: null, duplicate: false, skipped: true };
  }

  const { rows: versionRows } = await db.query<{ graph: unknown }>(
    `select graph from followup_flow_versions where id = $1 and organization_id = $2`,
    [pointer.active_version_id, organizationId],
  );
  const version = versionRows[0];
  if (!version) {
    return { followupId: null, duplicate: false, skipped: true };
  }
  const parsedGraph = flowGraphSchema.safeParse(version.graph);
  const triggerNode = parsedGraph.success ? parsedGraph.data.nodes.find((n) => n.type === 'trigger') : undefined;
  if (!triggerNode) {
    return { followupId: null, duplicate: false, skipped: true };
  }

  let enrollmentId: string;
  try {
    const { rows: insertRows } = await db.query<{ id: string }>(
      `insert into followup_enrollments (organization_id, pointer_id, version_id, contact_id, current_node_id, status, next_eval_at)
       values ($1, $2, $3, $4, $5, 'active', now())
       returning id`,
      [organizationId, pointer.id, pointer.active_version_id, run.contact_id, triggerNode.id],
    );
    const id = insertRows[0]?.id;
    if (!id) throw new Error('followup_enrollments insert returned no row');
    enrollmentId = id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      // idx_followup_enrollments_one_live: contact already has a live
      // enrollment on this pointer — not this workflow's to own.
      return { followupId: null, duplicate: false, skipped: true };
    }
    throw err;
  }

  await db.query(`update ai_workflow_runs set followup_id = $2 where id = $1 and organization_id = $3 and followup_id is null`, [
    workflowRunId,
    enrollmentId,
    organizationId,
  ]);

  return { followupId: enrollmentId, duplicate: false, skipped: false };
}

/**
 * Graph node wrapper — exported standalone (same convention as
 * `sendProposalOnceNode`). `graph.ts` wires this into the compiled graph's
 * `schedule_followup` node, injecting `db` via `config.configurable`.
 */
export async function scheduleFollowupOnceNode(
  state: ProposalFollowupNodeState,
  deps: { db: pg.Pool },
): Promise<Partial<ProposalGraphState>> {
  await scheduleFollowupOnce(state.workflow_run_id, state.organization_id, deps.db);
  return {};
}
