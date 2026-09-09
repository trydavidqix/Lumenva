/**
 * Fase 7 (LangGraph), Task 3 do plano — API de workflow (CRUD direto sobre
 * `ai_workflow_runs`; NÃO invoca o grafo LangGraph, escopo das Tasks 4-9).
 *
 * Cobre: criação (manager+, feature-gate, contact/conversation/lead
 * org-scoped, Idempotency-Key), listagem paginada, leitura por thread_id,
 * aprovação/rejeição (idempotente no re-decidir, 409 fora de
 * awaiting_approval), isolamento entre orgs e enforcement de role em todas
 * as rotas.
 *
 * Supabase é um fake in-memory reutilizável (`makeFakeDb`) que aplica os
 * MESMOS filtros `.eq()`/`.order()`/`.limit()` que as rotas emitem — prova
 * que o isolamento de tenant vem da query da rota, não de um stub que já
 * devolve só a linha certa.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { resolveAiPlatformFeature } from "@/lib/agent-engine/platform/features";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { audit } from "@/lib/audit";
import { fail } from "@/lib/api/wrappers";
import { ROLE_RANK, type AuthUser, type Role } from "@/lib/auth/types";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/agent-engine/platform/features", () => ({ resolveAiPlatformFeature: vi.fn() }));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, count: 1, limit: 30, window_sec: 60 })),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_A = "22222222-2222-4222-8222-222222222222";
const ORG_B = "99999999-9999-4999-8999-999999999999";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const CONTACT_A = "33333333-3333-4333-8333-333333333333";
const CONTACT_B = "88888888-8888-4888-8888-888888888888";
const THREAD_A = "44444444-4444-4444-8444-444444444444";

function session(effectiveRole: Role, orgId: string = ORG_A) {
  const user: AuthUser = {
    id: USER_ID,
    email: "u@example.com",
    full_name: null,
    avatar_url: null,
    is_platform_admin: false,
    organizations: [{ organization_id: orgId, organization_name: "Org", role: effectiveRole }],
  };
  vi.mocked(requireRole).mockImplementation(async (min: Role) => {
    if (ROLE_RANK[effectiveRole] >= ROLE_RANK[min]) {
      return { ok: true, user, org: { orgId, name: "Org", role: effectiveRole } };
    }
    return { ok: false, response: fail("forbidden_role", `Requer role >= ${min}.`, 403, {}) };
  });
}

// ---------------------------------------------------------------------------
// Fake Supabase: applies real `.eq()`/`.order()`/`.limit()` filters so tests
// prove tenant isolation is enforced by the ROUTE's query, not by a stub
// that already only holds the "right" rows.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function stableSort(rows: Row[], col: string, ascending: boolean): Row[] {
  return [...rows].sort((a, b) => {
    const av = a[col] as string;
    const bv = b[col] as string;
    if (av === bv) return 0;
    return (av < bv ? -1 : 1) * (ascending ? 1 : -1);
  });
}

function checkUniqueConflict(table: string, existing: Row[], candidate: Row): boolean {
  if (table === "idempotency_keys") {
    return existing.some(
      (r) =>
        r.organization_id === candidate.organization_id &&
        r.endpoint === candidate.endpoint &&
        r.key === candidate.key,
    );
  }
  return false;
}

let genCounter = 0;

function makeFakeDb(seed: Record<string, Row[]> = {}) {
  const store: Record<string, Row[]> = {};
  for (const [t, rows] of Object.entries(seed)) store[t] = rows.map((r) => ({ ...r }));

  function from(table: string) {
    if (!store[table]) store[table] = [];
    let mode: "select" | "insert" | "update" | "delete" = "select";
    let insertPayload: Row | null = null;
    let updatePayload: Row | null = null;
    const eqFilters: Array<[string, unknown]> = [];
    let orString: string | null = null;
    const orderSpecs: Array<{ col: string; ascending: boolean }> = [];
    let limitN: number | null = null;

    function rowMatches(row: Row): boolean {
      for (const [k, v] of eqFilters) if (row[k] !== v) return false;
      // `.or()` (keyset cursor) not exercised by these tests — accept all
      // rows that already passed the `.eq()` filters instead of parsing the
      // PostgREST OR expression.
      void orString;
      return true;
    }

    function exec(): { data: unknown; error: { code?: string; message: string } | null } {
      if (mode === "insert" && insertPayload) {
        const now = new Date().toISOString();
        genCounter += 1;
        const row: Row = {
          id: `generated-${genCounter}`,
          created_at: now,
          updated_at: now,
          ...insertPayload,
        };
        if (checkUniqueConflict(table, store[table] ?? [], row)) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        store[table] = [...(store[table] ?? []), row];
        return { data: row, error: null };
      }
      if (mode === "update" && updatePayload) {
        const matched = (store[table] ?? []).filter(rowMatches);
        matched.forEach((r) => Object.assign(r, updatePayload));
        return { data: matched, error: null };
      }
      if (mode === "delete") {
        store[table] = (store[table] ?? []).filter((r) => !rowMatches(r));
        return { data: null, error: null };
      }
      let rows = (store[table] ?? []).filter(rowMatches);
      for (const o of [...orderSpecs].reverse()) rows = stableSort(rows, o.col, o.ascending);
      if (limitN != null) rows = rows.slice(0, limitN);
      return { data: rows, error: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select: () => chain,
      insert: (p: Row) => {
        mode = "insert";
        insertPayload = p;
        return chain;
      },
      update: (p: Row) => {
        mode = "update";
        updatePayload = p;
        return chain;
      },
      delete: () => {
        mode = "delete";
        return chain;
      },
      eq: (col: string, val: unknown) => {
        eqFilters.push([col, val]);
        return chain;
      },
      or: (expr: string) => {
        orString = expr;
        return chain;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        orderSpecs.push({ col, ascending: opts?.ascending !== false });
        return chain;
      },
      limit: (n: number) => {
        limitN = n;
        return chain;
      },
      maybeSingle: async () => {
        const r = exec();
        if (r.error) return r;
        const rows = Array.isArray(r.data) ? r.data : r.data ? [r.data] : [];
        return { data: rows[0] ?? null, error: null };
      },
      single: async () => {
        const r = exec();
        if (r.error) return r;
        const rows = Array.isArray(r.data) ? r.data : r.data ? [r.data] : [];
        return { data: rows[0] ?? null, error: null };
      },
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(exec()).then(onF, onR),
    };
    return chain;
  }
  return { from, __store: store };
}

function contactRow(id: string, orgId: string): Row {
  return { id, organization_id: orgId };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, count: 1, limit: 30, window_sec: 60 });
});

// ---------------------------------------------------------------------------
// POST /api/v1/workflows
// ---------------------------------------------------------------------------

describe("POST /api/v1/workflows", () => {
  function req(body: Record<string, unknown>, headers?: Record<string, string>) {
    return new NextRequest("http://localhost/api/v1/workflows", {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    });
  }

  it("viewer é barrado (403 forbidden_role), sem criar linha", async () => {
    session("viewer");
    const { POST } = await import("@/app/api/v1/workflows/route");
    const res = await POST(req({ contact_id: CONTACT_A }));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("forbidden_role");
  });

  it("feature 'off' bloqueia a criação (403), sem tocar o banco", async () => {
    session("manager");
    vi.mocked(resolveAiPlatformFeature).mockResolvedValue({ mode: "off", config: {}, killed: false });
    const db = makeFakeDb({ contacts: [contactRow(CONTACT_A, ORG_A)] });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { POST } = await import("@/app/api/v1/workflows/route");
    const res = await POST(req({ contact_id: CONTACT_A }));
    expect(res.status).toBe(403);
    expect(db.__store.ai_workflow_runs ?? []).toHaveLength(0);
  });

  it("mode='shadow': cria com status inicial 'shadow' e audita workflow.created", async () => {
    session("manager");
    vi.mocked(resolveAiPlatformFeature).mockResolvedValue({ mode: "shadow", config: {}, killed: false });
    const db = makeFakeDb({ contacts: [contactRow(CONTACT_A, ORG_A)] });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { POST } = await import("@/app/api/v1/workflows/route");
    const res = await POST(req({ contact_id: CONTACT_A }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { thread_id: string; status: string; id: string } };
    expect(body.data.status).toBe("shadow");
    expect(body.data.thread_id).toBeTruthy();

    const created = db.__store.ai_workflow_runs?.[0] as Row;
    expect(created.organization_id).toBe(ORG_A);
    expect(created.workflow_type).toBe("commercial_proposal");
    // thread_id/side_effect_key nunca vêm do body — sempre gerados no servidor.
    expect(created.thread_id).not.toBe(CONTACT_A);
    expect(created.side_effect_key).toContain(String(created.thread_id));

    expect(
      vi.mocked(audit).mock.calls.some(([e]) => e.action === "workflow.created" && e.organizationId === ORG_A),
    ).toBe(true);
  });

  it("mode='canary': cria com status inicial 'drafting'", async () => {
    session("manager");
    vi.mocked(resolveAiPlatformFeature).mockResolvedValue({ mode: "canary", config: {}, killed: false });
    const db = makeFakeDb({ contacts: [contactRow(CONTACT_A, ORG_A)] });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { POST } = await import("@/app/api/v1/workflows/route");
    const res = await POST(req({ contact_id: CONTACT_A }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe("drafting");
  });

  it("contact_id de outra org → 404, nenhuma linha criada", async () => {
    session("manager");
    vi.mocked(resolveAiPlatformFeature).mockResolvedValue({ mode: "shadow", config: {}, killed: false });
    // CONTACT_B existe, mas pertence à ORG_B — a org ativa é ORG_A.
    const db = makeFakeDb({ contacts: [contactRow(CONTACT_B, ORG_B)] });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { POST } = await import("@/app/api/v1/workflows/route");
    const res = await POST(req({ contact_id: CONTACT_B }));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
    expect(db.__store.ai_workflow_runs ?? []).toHaveLength(0);
  });

  it("body inválido (contact_id ausente) → 422 validation_failed", async () => {
    session("manager");
    const db = makeFakeDb();
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { POST } = await import("@/app/api/v1/workflows/route");
    const res = await POST(req({}));
    expect(res.status).toBe(422);
  });

  it("Idempotency-Key: mesma key + mesmo payload replaya a resposta sem criar segunda linha", async () => {
    session("manager");
    vi.mocked(resolveAiPlatformFeature).mockResolvedValue({ mode: "shadow", config: {}, killed: false });
    const db = makeFakeDb({ contacts: [contactRow(CONTACT_A, ORG_A)] });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { POST } = await import("@/app/api/v1/workflows/route");
    const headers = { "Idempotency-Key": "idem-key-1", "Content-Type": "application/json" };
    const res1 = await POST(req({ contact_id: CONTACT_A }, headers));
    expect(res1.status).toBe(201);
    const body1 = (await res1.json()) as { data: { thread_id: string } };

    const res2 = await POST(req({ contact_id: CONTACT_A }, headers));
    expect(res2.status).toBe(201);
    const body2 = (await res2.json()) as { data: { thread_id: string } };

    expect(body2.data.thread_id).toBe(body1.data.thread_id);
    expect(db.__store.ai_workflow_runs ?? []).toHaveLength(1);
  });

  it("Idempotency-Key: mesma key + payload diferente → 409 idempotency_conflict", async () => {
    session("manager");
    vi.mocked(resolveAiPlatformFeature).mockResolvedValue({ mode: "shadow", config: {}, killed: false });
    const db = makeFakeDb({
      contacts: [contactRow(CONTACT_A, ORG_A), contactRow(CONTACT_B, ORG_A)],
    });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { POST } = await import("@/app/api/v1/workflows/route");
    const headers = { "Idempotency-Key": "idem-key-2", "Content-Type": "application/json" };
    const res1 = await POST(req({ contact_id: CONTACT_A }, headers));
    expect(res1.status).toBe(201);

    const res2 = await POST(req({ contact_id: CONTACT_B }, headers));
    expect(res2.status).toBe(409);
    const body2 = (await res2.json()) as { error: { code: string } };
    expect(body2.error.code).toBe("idempotency_conflict");
    expect(db.__store.ai_workflow_runs ?? []).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/workflows
// ---------------------------------------------------------------------------

describe("GET /api/v1/workflows", () => {
  function workflowRow(id: string, orgId: string, overrides: Partial<Row> = {}): Row {
    return {
      id,
      organization_id: orgId,
      workflow_type: "commercial_proposal",
      thread_id: `thread-${id}`,
      contact_id: CONTACT_A,
      conversation_id: null,
      lead_id: null,
      status: "shadow",
      draft_payload: {},
      decision_payload: null,
      decided_by: null,
      decided_at: null,
      side_effect_key: `commercial_proposal:thread-${id}`,
      sent_message_id: null,
      followup_id: null,
      last_error_code: null,
      created_by: USER_ID,
      created_at: `2026-08-0${id}T10:00:00.000Z`,
      updated_at: `2026-08-0${id}T10:00:00.000Z`,
      ...overrides,
    };
  }

  it("viewer é barrado (403 forbidden_role)", async () => {
    session("viewer");
    const { GET } = await import("@/app/api/v1/workflows/route");
    const res = await GET(new NextRequest("http://localhost/api/v1/workflows"));
    expect(res.status).toBe(403);
  });

  it("lista só workflows da org ativa, isolando outra org", async () => {
    session("manager");
    const db = makeFakeDb({
      ai_workflow_runs: [workflowRow("1", ORG_A), workflowRow("2", ORG_B), workflowRow("3", ORG_A)],
    });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { GET } = await import("@/app/api/v1/workflows/route");
    const res = await GET(new NextRequest("http://localhost/api/v1/workflows"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ organization_id: string }>; meta: { has_more: boolean } };
    expect(body.data).toHaveLength(2);
    expect(body.data.every((r) => r.organization_id === ORG_A)).toBe(true);
    expect(body.meta.has_more).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/workflows/:thread_id
// ---------------------------------------------------------------------------

describe("GET /api/v1/workflows/:thread_id", () => {
  function fullRow(overrides: Partial<Row> = {}): Row {
    return {
      id: "wf-1",
      organization_id: ORG_A,
      workflow_type: "commercial_proposal",
      thread_id: THREAD_A,
      contact_id: CONTACT_A,
      conversation_id: null,
      lead_id: null,
      status: "awaiting_approval",
      draft_payload: { body: "Proposta rascunho" },
      decision_payload: null,
      decided_by: null,
      decided_at: null,
      side_effect_key: `commercial_proposal:${THREAD_A}`,
      sent_message_id: null,
      followup_id: null,
      last_error_code: null,
      created_by: USER_ID,
      created_at: "2026-08-01T10:00:00.000Z",
      updated_at: "2026-08-01T10:00:00.000Z",
      ...overrides,
    };
  }

  it("thread_id com formato inválido → 400 invalid_request", async () => {
    session("manager");
    const { GET } = await import("@/app/api/v1/workflows/[thread_id]/route");
    const res = await GET(new NextRequest("http://localhost/api/v1/workflows/not-a-uuid"), {
      params: Promise.resolve({ thread_id: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
  });

  it("manager+ da própria org lê a linha inteira, incluindo draft_payload", async () => {
    session("manager");
    const db = makeFakeDb({ ai_workflow_runs: [fullRow()] });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { GET } = await import("@/app/api/v1/workflows/[thread_id]/route");
    const res = await GET(new NextRequest(`http://localhost/api/v1/workflows/${THREAD_A}`), {
      params: Promise.resolve({ thread_id: THREAD_A }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { thread_id: string; draft_payload: { body: string } } };
    expect(body.data.thread_id).toBe(THREAD_A);
    expect(body.data.draft_payload.body).toBe("Proposta rascunho");
  });

  it("thread_id existente em OUTRA org → 404 (isolamento de tenant)", async () => {
    session("manager", ORG_B);
    const db = makeFakeDb({ ai_workflow_runs: [fullRow({ organization_id: ORG_A })] });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { GET } = await import("@/app/api/v1/workflows/[thread_id]/route");
    const res = await GET(new NextRequest(`http://localhost/api/v1/workflows/${THREAD_A}`), {
      params: Promise.resolve({ thread_id: THREAD_A }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/workflows/:thread_id/approve
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/workflows/:thread_id/approve", () => {
  function awaitingRow(overrides: Partial<Row> = {}): Row {
    return {
      id: "wf-1",
      organization_id: ORG_A,
      workflow_type: "commercial_proposal",
      thread_id: THREAD_A,
      contact_id: CONTACT_A,
      conversation_id: null,
      lead_id: null,
      status: "awaiting_approval",
      draft_payload: {},
      decision_payload: null,
      decided_by: null,
      decided_at: null,
      side_effect_key: `commercial_proposal:${THREAD_A}`,
      sent_message_id: null,
      followup_id: null,
      last_error_code: null,
      created_by: USER_ID,
      created_at: "2026-08-01T10:00:00.000Z",
      updated_at: "2026-08-01T10:00:00.000Z",
      ...overrides,
    };
  }

  function patchReq() {
    return new NextRequest(`http://localhost/api/v1/workflows/${THREAD_A}/approve`, { method: "PATCH" });
  }

  it("viewer é barrado (403 forbidden_role)", async () => {
    session("viewer");
    const { PATCH } = await import("@/app/api/v1/workflows/[thread_id]/approve/route");
    const res = await PATCH(patchReq(), { params: Promise.resolve({ thread_id: THREAD_A }) });
    expect(res.status).toBe(403);
  });

  it("awaiting_approval → approved: seta decided_by/decided_at e audita workflow.approved", async () => {
    session("manager");
    const db = makeFakeDb({ ai_workflow_runs: [awaitingRow()] });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { PATCH } = await import("@/app/api/v1/workflows/[thread_id]/approve/route");
    const res = await PATCH(patchReq(), { params: Promise.resolve({ thread_id: THREAD_A }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string; decided_by: string; decided_at: string } };
    expect(body.data.status).toBe("approved");
    expect(body.data.decided_by).toBe(USER_ID);
    expect(body.data.decided_at).toBeTruthy();
    expect(
      vi.mocked(audit).mock.calls.some(([e]) => e.action === "workflow.approved"),
    ).toBe(true);
  });

  it("reaprovar um workflow já 'approved' é idempotente (200, sem reescrever decided_at)", async () => {
    session("manager");
    const firstDecidedAt = "2026-08-01T09:00:00.000Z";
    const db = makeFakeDb({
      ai_workflow_runs: [
        awaitingRow({ status: "approved", decided_by: USER_ID, decided_at: firstDecidedAt }),
      ],
    });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { PATCH } = await import("@/app/api/v1/workflows/[thread_id]/approve/route");
    const res = await PATCH(patchReq(), { params: Promise.resolve({ thread_id: THREAD_A }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string; decided_at: string } };
    expect(body.data.status).toBe("approved");
    expect(body.data.decided_at).toBe(firstDecidedAt);
    expect(vi.mocked(audit)).not.toHaveBeenCalled();
  });

  it("estado fora de awaiting_approval/approved (ex.: 'shadow') → 409 invalid_state", async () => {
    session("manager");
    const db = makeFakeDb({ ai_workflow_runs: [awaitingRow({ status: "shadow" })] });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { PATCH } = await import("@/app/api/v1/workflows/[thread_id]/approve/route");
    const res = await PATCH(patchReq(), { params: Promise.resolve({ thread_id: THREAD_A }) });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_state");
  });

  it("thread_id inexistente/de outra org → 404, sem mutar nada", async () => {
    session("manager", ORG_B);
    const db = makeFakeDb({ ai_workflow_runs: [awaitingRow({ organization_id: ORG_A })] });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { PATCH } = await import("@/app/api/v1/workflows/[thread_id]/approve/route");
    const res = await PATCH(patchReq(), { params: Promise.resolve({ thread_id: THREAD_A }) });
    expect(res.status).toBe(404);
    expect((db.__store.ai_workflow_runs?.[0] as Row).status).toBe("awaiting_approval");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/workflows/:thread_id/reject
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/workflows/:thread_id/reject", () => {
  function awaitingRow(overrides: Partial<Row> = {}): Row {
    return {
      id: "wf-1",
      organization_id: ORG_A,
      workflow_type: "commercial_proposal",
      thread_id: THREAD_A,
      contact_id: CONTACT_A,
      conversation_id: null,
      lead_id: null,
      status: "awaiting_approval",
      draft_payload: {},
      decision_payload: null,
      decided_by: null,
      decided_at: null,
      side_effect_key: `commercial_proposal:${THREAD_A}`,
      sent_message_id: null,
      followup_id: null,
      last_error_code: null,
      created_by: USER_ID,
      created_at: "2026-08-01T10:00:00.000Z",
      updated_at: "2026-08-01T10:00:00.000Z",
      ...overrides,
    };
  }

  function patchReq(body?: Record<string, unknown>) {
    return new NextRequest(`http://localhost/api/v1/workflows/${THREAD_A}/reject`, {
      method: "PATCH",
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  it("awaiting_approval → rejected: registra reason no decision_payload e audita", async () => {
    session("manager");
    const db = makeFakeDb({ ai_workflow_runs: [awaitingRow()] });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { PATCH } = await import("@/app/api/v1/workflows/[thread_id]/reject/route");
    const res = await PATCH(patchReq({ reason: "Preço fora da política" }), {
      params: Promise.resolve({ thread_id: THREAD_A }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { status: string; decision_payload: { reason?: string } };
    };
    expect(body.data.status).toBe("rejected");
    expect(body.data.decision_payload.reason).toBe("Preço fora da política");
    expect(vi.mocked(audit).mock.calls.some(([e]) => e.action === "workflow.rejected")).toBe(true);
  });

  it("rejeitar um workflow já 'rejected' é idempotente (200, sem reemitir audit)", async () => {
    session("manager");
    const db = makeFakeDb({
      ai_workflow_runs: [
        awaitingRow({ status: "rejected", decided_by: USER_ID, decided_at: "2026-08-01T09:00:00.000Z" }),
      ],
    });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { PATCH } = await import("@/app/api/v1/workflows/[thread_id]/reject/route");
    const res = await PATCH(patchReq(), { params: Promise.resolve({ thread_id: THREAD_A }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe("rejected");
    expect(vi.mocked(audit)).not.toHaveBeenCalled();
  });

  it("já 'approved' → reject retorna 409 invalid_state (não pode rejeitar após aprovado)", async () => {
    session("manager");
    const db = makeFakeDb({
      ai_workflow_runs: [
        awaitingRow({ status: "approved", decided_by: USER_ID, decided_at: "2026-08-01T09:00:00.000Z" }),
      ],
    });
    vi.mocked(createClient).mockResolvedValue(db as never);

    const { PATCH } = await import("@/app/api/v1/workflows/[thread_id]/reject/route");
    const res = await PATCH(patchReq(), { params: Promise.resolve({ thread_id: THREAD_A }) });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_state");
  });
});
