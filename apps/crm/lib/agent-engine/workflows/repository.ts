/**
 * Phase 7 LangGraph pilot — server-generated workflow-run repository
 * (plan Task 5: `docs/superpowers/plans/2026-08-10-ai-platform-phase-7-langgraph.md`,
 * "Add server-generated workflow-run repository and thread binding").
 *
 * SCOPE NOTE: `app/api/v1/workflows/route.ts` (commit c876db17, pre-existing
 * on this branch) already creates `ai_workflow_runs` rows inline using the
 * request-scoped RLS session client (`@/lib/supabase/server`) — correct for
 * that route because it always runs inside an authenticated HTTP request
 * where a manager+ session already exists. `createProposalWorkflowRun()`
 * below is the ADMIN-CLIENT (service-role) counterpart for callers that need
 * to create a workflow run OUTSIDE that request context — a worker, a cron
 * job, or future graph-orchestration code with no user session to scope RLS
 * to (one of the allowed uses documented in `lib/supabase/admin.ts`). It
 * does not replace or refactor the existing route/its Idempotency-Key
 * handling/audit emission/rate limiting, which stay the route's own
 * responsibility for HTTP-triggered creation; having the route delegate to
 * this function instead of duplicating the validation logic is a reasonable
 * future cleanup, left out of scope here per `.claude/rules/git-workflow.md`
 * "disciplina de escopo".
 *
 * Multi-tenancy (CLAUDE.md invariant #1 / `.claude/rules/multi-tenancy.md`):
 * the admin client bypasses RLS, so every lookup below filters
 * `organization_id` explicitly. `organizationId` itself is NOT resolved here
 * — the caller must supply it from a trusted source (validated session/JWT,
 * webhook secret mapping, etc.), never from an untrusted request body passed
 * straight through.
 *
 * `thread_id` and `side_effect_key` are generated SERVER-SIDE only (Phase 7
 * global constraint, existing channel idempotency doctrine applied to this
 * domain) — the input type has no field for either, so a caller cannot pass
 * them in even by mistake.
 */
import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

/** Matches `app/api/v1/workflows/_shared.ts` — Phase 7 v1 pilots exactly one workflow type. */
export const WORKFLOW_TYPE = "commercial_proposal" as const;
export type WorkflowType = typeof WORKFLOW_TYPE;

/** Matches the `ai_workflow_runs.status` CHECK vocabulary (migration 0119). */
export type WorkflowRunStatus =
  | "shadow"
  | "drafting"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "sending"
  | "completed"
  | "failed"
  | "cancelled";

export type ProposalWorkflowRunMode = "shadow" | "canary" | "on";

/**
 * `shadow` nasce `shadow` (drafts avaliados, sem side effect real, sem exigir
 * aprovação humana — doutrina da Fase 7). `canary`/`on` nascem `drafting`, o
 * primeiro passo do fluxo real de aprovação. Mesma regra de
 * `app/api/v1/workflows/_shared.ts#initialStatusForMode`, reimplementada
 * aqui (não importada de `app/`) para manter este módulo de `lib/`
 * independente da camada de rota.
 */
export function initialStatusForWorkflowMode(mode: ProposalWorkflowRunMode): WorkflowRunStatus {
  return mode === "shadow" ? "shadow" : "drafting";
}

/**
 * Deterministic given `threadId`: same thread id always yields the same
 * side-effect key, so a caller that already knows a run's `thread_id` can
 * always recompute its `side_effect_key` without a DB round-trip. This is
 * NOT meant to make two separate `createProposalWorkflowRun()` calls
 * collide — `threadId` is fresh (server-generated) per call, so each call
 * creates a new, distinct logical run with its own stable key.
 */
export function buildWorkflowRunSideEffectKey(threadId: string): string {
  return `${WORKFLOW_TYPE}:${threadId}`;
}

export interface CreateProposalWorkflowRunInput {
  organizationId: string;
  contactId: string;
  conversationId?: string | null;
  leadId?: string | null;
  createdBy: string;
  mode: ProposalWorkflowRunMode;
}

export interface CreateProposalWorkflowRunResult {
  runId: string;
  threadId: string;
  sideEffectKey: string;
}

export type WorkflowRunRepositoryErrorCode =
  | "contact_not_in_organization"
  | "conversation_not_in_organization"
  | "lead_not_in_organization"
  | "lookup_failed"
  | "insert_failed";

export class WorkflowRunRepositoryError extends Error {
  constructor(
    public readonly code: WorkflowRunRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkflowRunRepositoryError";
  }
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Confirms `id` exists in `table` AND belongs to `organizationId` — the
 * admin client bypasses RLS, so this explicit filter IS the tenant boundary
 * (a bare `select().eq("id", id)` would happily return a row from any org).
 * Throws instead of returning a boolean so a caller can't accidentally
 * ignore a cross-org reference.
 */
async function assertBelongsToOrganization(
  admin: AdminClient,
  table: "contacts" | "conversations" | "crm_leads",
  id: string,
  organizationId: string,
  errorCode: WorkflowRunRepositoryErrorCode,
  label: string,
): Promise<void> {
  const { data, error } = await admin
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("organization_id", organizationId) // explicit tenant filter — admin client bypasses RLS
    .maybeSingle();

  if (error) {
    throw new WorkflowRunRepositoryError(
      "lookup_failed",
      `[workflows-repository] ${label} lookup failed: ${error.message}`,
    );
  }
  if (!data) {
    throw new WorkflowRunRepositoryError(
      errorCode,
      `[workflows-repository] ${label} ${id} does not belong to organization ${organizationId}`,
    );
  }
}

/**
 * Creates the tenant-owned `ai_workflow_runs` row for a new
 * `commercial_proposal` LangGraph run and binds it a fresh, server-generated
 * `thread_id`. Never accepts `thread_id`/`side_effect_key` from the caller —
 * both are always minted here.
 *
 * Validates `contactId` (required) and `conversationId`/`leadId` (optional)
 * all belong to `organizationId` BEFORE writing anything — a cross-org
 * reference throws and no row is inserted.
 */
export async function createProposalWorkflowRun(
  input: CreateProposalWorkflowRunInput,
): Promise<CreateProposalWorkflowRunResult> {
  const admin = createAdminClient();

  await assertBelongsToOrganization(
    admin,
    "contacts",
    input.contactId,
    input.organizationId,
    "contact_not_in_organization",
    "contact",
  );

  if (input.conversationId) {
    await assertBelongsToOrganization(
      admin,
      "conversations",
      input.conversationId,
      input.organizationId,
      "conversation_not_in_organization",
      "conversation",
    );
  }

  if (input.leadId) {
    await assertBelongsToOrganization(
      admin,
      "crm_leads",
      input.leadId,
      input.organizationId,
      "lead_not_in_organization",
      "lead",
    );
  }

  const threadId = randomUUID();
  const sideEffectKey = buildWorkflowRunSideEffectKey(threadId);

  const { data, error } = await admin
    .from("ai_workflow_runs")
    .insert({
      organization_id: input.organizationId,
      workflow_type: WORKFLOW_TYPE,
      thread_id: threadId,
      contact_id: input.contactId,
      conversation_id: input.conversationId ?? null,
      lead_id: input.leadId ?? null,
      status: initialStatusForWorkflowMode(input.mode),
      draft_payload: {},
      side_effect_key: sideEffectKey,
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new WorkflowRunRepositoryError(
      "insert_failed",
      `[workflows-repository] createProposalWorkflowRun insert failed: ${error?.message ?? "no row returned"}`,
    );
  }

  return {
    runId: (data as { id: string }).id,
    threadId,
    sideEffectKey,
  };
}
