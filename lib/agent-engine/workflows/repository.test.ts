import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 7 LangGraph pilot — `createProposalWorkflowRun()` (plan Task 5).
 *
 * Fake Supabase admin client applies REAL `.eq()` filters against seeded
 * per-org row lists (same "progressive candidate narrowing" technique as
 * `lib/ai/rag/publication/publish-policy.test.ts`), so a dropped
 * `organization_id` filter in the module under test would WIDEN the match
 * set instead of silently narrowing to zero — exactly the failure mode this
 * suite exists to catch (CLAUDE.md multi-tenancy invariant: admin client
 * bypasses RLS, so the explicit filter IS the tenant boundary).
 */

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Row = Record<string, string>;

let contactsTable: Row[];
let conversationsTable: Row[];
let leadsTable: Row[];
let insertedRows: Array<Record<string, unknown>>;
let insertShouldFail: { message: string } | null;
let insertReturnsNoRow: boolean;

const eqFilterableTable = (rows: Row[]) => ({
  select: () => {
    let candidates = rows;
    const builder = {
      eq: (col: string, val: string) => {
        candidates = candidates.filter((row) => row[col] === val);
        return builder;
      },
      maybeSingle: async () => ({ data: candidates[0] ?? null, error: null }),
    };
    return builder;
  },
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "contacts") return eqFilterableTable(contactsTable);
      if (table === "conversations") return eqFilterableTable(conversationsTable);
      if (table === "crm_leads") return eqFilterableTable(leadsTable);
      if (table === "ai_workflow_runs") {
        return {
          insert: (row: Record<string, unknown>) => {
            insertedRows.push(row);
            return {
              select: () => ({
                single: async () => {
                  if (insertShouldFail) return { data: null, error: insertShouldFail };
                  if (insertReturnsNoRow) return { data: null, error: null };
                  return { data: { id: "run-11111111-1111-4111-8111-111111111111" }, error: null };
                },
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import {
  buildWorkflowRunSideEffectKey,
  createProposalWorkflowRun,
  initialStatusForWorkflowMode,
  WorkflowRunRepositoryError,
  WORKFLOW_TYPE,
} from "./repository";

const ORG_A = "22222222-2222-4222-8222-222222222222";
const ORG_B = "99999999-9999-4999-8999-999999999999";
const CONTACT_A = "33333333-3333-4333-8333-333333333333";
const CONVERSATION_A = "44444444-4444-4444-8444-444444444444";
const LEAD_A = "55555555-5555-4555-8555-555555555555";
const USER_A = "66666666-6666-4666-8666-666666666666";

function baseInput(overrides: Partial<Parameters<typeof createProposalWorkflowRun>[0]> = {}) {
  return {
    organizationId: ORG_A,
    contactId: CONTACT_A,
    conversationId: null,
    leadId: null,
    createdBy: USER_A,
    mode: "shadow" as const,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  insertedRows = [];
  insertShouldFail = null;
  insertReturnsNoRow = false;

  // One row per id (globally-unique PK, same as the real `contacts` table) —
  // each belongs to exactly ORG_A, matching real Postgres shape. Cross-org
  // tests below reassign a row's `organization_id` to prove the lookup is
  // scoped by BOTH id and org, not id alone (a dropped
  // `.eq("organization_id", ...)` would still find the row by id and wrongly
  // succeed).
  contactsTable = [{ id: CONTACT_A, organization_id: ORG_A }];
  conversationsTable = [{ id: CONVERSATION_A, organization_id: ORG_A }];
  leadsTable = [{ id: LEAD_A, organization_id: ORG_A }];
});

describe("createProposalWorkflowRun", () => {
  it("gera thread_id server-side como UUID v4 válido, nunca aceito do caller (input não tem esse campo)", async () => {
    const result = await createProposalWorkflowRun(baseInput());
    expect(result.threadId).toMatch(UUID_RX);
  });

  it("duas chamadas geram thread_ids DIFERENTES — não é um valor fixo/hardcoded", async () => {
    const r1 = await createProposalWorkflowRun(baseInput());
    const r2 = await createProposalWorkflowRun(baseInput());
    expect(r1.threadId).not.toBe(r2.threadId);
  });

  it("grava exatamente o thread_id gerado na linha inserida (não um valor diferente)", async () => {
    const result = await createProposalWorkflowRun(baseInput());
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({ thread_id: result.threadId });
  });

  it("side_effect_key é determinístico: build(threadId) sempre devolve o MESMO valor para o mesmo threadId", () => {
    const threadId = "77777777-7777-4777-8777-777777777777";
    expect(buildWorkflowRunSideEffectKey(threadId)).toBe(buildWorkflowRunSideEffectKey(threadId));
    expect(buildWorkflowRunSideEffectKey(threadId)).toBe(`${WORKFLOW_TYPE}:${threadId}`);
  });

  it("side_effect_key retornado é o MESMO gravado na linha (consistência run <-> row)", async () => {
    const result = await createProposalWorkflowRun(baseInput());
    expect(insertedRows[0]?.side_effect_key).toBe(result.sideEffectKey);
    expect(result.sideEffectKey).toBe(buildWorkflowRunSideEffectKey(result.threadId));
  });

  it("contato pertencente à MESMA org: cria a linha com sucesso", async () => {
    const result = await createProposalWorkflowRun(baseInput());
    expect(result.runId).toBe("run-11111111-1111-4111-8111-111111111111");
    expect(insertedRows[0]).toMatchObject({
      organization_id: ORG_A,
      workflow_type: WORKFLOW_TYPE,
      contact_id: CONTACT_A,
      conversation_id: null,
      lead_id: null,
      status: "shadow",
      draft_payload: {},
      created_by: USER_A,
    });
  });

  it("contato existe mas pertence a OUTRA org: rejeita, nenhuma linha é inserida (bloqueio cross-tenant)", async () => {
    // Same contact id, owned by ORG_B — the run is requested for ORG_A.
    contactsTable = [{ id: CONTACT_A, organization_id: ORG_B }];
    await expect(
      createProposalWorkflowRun(baseInput({ organizationId: ORG_A, contactId: CONTACT_A })),
    ).rejects.toMatchObject({ code: "contact_not_in_organization" });
    expect(insertedRows).toHaveLength(0);
  });

  it("contato inexistente em qualquer org: rejeita, nenhuma linha inserida", async () => {
    await expect(
      createProposalWorkflowRun(baseInput({ contactId: "00000000-0000-4000-8000-000000000000" })),
    ).rejects.toBeInstanceOf(WorkflowRunRepositoryError);
    expect(insertedRows).toHaveLength(0);
  });

  it("conversationId que não pertence à org do contato válido: rejeita antes de inserir", async () => {
    // Contact is valid under ORG_A; the conversation with the same id only
    // exists under ORG_B — proves the conversation check is independently
    // org-scoped, not just inherited from the contact check passing.
    conversationsTable = [{ id: CONVERSATION_A, organization_id: ORG_B }];
    await expect(
      createProposalWorkflowRun(baseInput({ conversationId: CONVERSATION_A })),
    ).rejects.toMatchObject({ code: "conversation_not_in_organization" });
    expect(insertedRows).toHaveLength(0);
  });

  it("leadId que não pertence à mesma org: rejeita antes de inserir", async () => {
    leadsTable = [{ id: LEAD_A, organization_id: ORG_B }];
    await expect(createProposalWorkflowRun(baseInput({ leadId: LEAD_A }))).rejects.toMatchObject({
      code: "lead_not_in_organization",
    });
    expect(insertedRows).toHaveLength(0);
  });

  it("conversationId e leadId válidos na MESMA org: grava ambos na linha", async () => {
    const result = await createProposalWorkflowRun(
      baseInput({ conversationId: CONVERSATION_A, leadId: LEAD_A }),
    );
    expect(insertedRows[0]).toMatchObject({
      conversation_id: CONVERSATION_A,
      lead_id: LEAD_A,
    });
    expect(result.runId).toBeTruthy();
  });

  it("mode='shadow' grava status inicial 'shadow'", async () => {
    await createProposalWorkflowRun(baseInput({ mode: "shadow" }));
    expect(insertedRows[0]).toMatchObject({ status: "shadow" });
  });

  it("mode='canary' grava status inicial 'drafting'", async () => {
    await createProposalWorkflowRun(baseInput({ mode: "canary" }));
    expect(insertedRows[0]).toMatchObject({ status: "drafting" });
  });

  it("mode='on' grava status inicial 'drafting'", async () => {
    await createProposalWorkflowRun(baseInput({ mode: "on" }));
    expect(insertedRows[0]).toMatchObject({ status: "drafting" });
  });

  it("initialStatusForWorkflowMode é a função pura usada acima (cobertura direta)", () => {
    expect(initialStatusForWorkflowMode("shadow")).toBe("shadow");
    expect(initialStatusForWorkflowMode("canary")).toBe("drafting");
    expect(initialStatusForWorkflowMode("on")).toBe("drafting");
  });

  it("falha no INSERT (erro do banco): lança WorkflowRunRepositoryError code='insert_failed'", async () => {
    insertShouldFail = { message: "constraint violation" };
    await expect(createProposalWorkflowRun(baseInput())).rejects.toMatchObject({
      code: "insert_failed",
    });
  });

  it("INSERT sem erro mas sem linha retornada: também falha fechado como 'insert_failed'", async () => {
    insertReturnsNoRow = true;
    await expect(createProposalWorkflowRun(baseInput())).rejects.toMatchObject({
      code: "insert_failed",
    });
  });

  it("erros lançados são sempre WorkflowRunRepositoryError (tipo estável para o caller)", async () => {
    await expect(
      createProposalWorkflowRun(baseInput({ contactId: "inexistente" })),
    ).rejects.toBeInstanceOf(WorkflowRunRepositoryError);
  });
});
