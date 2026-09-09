/**
 * AI Platform Phase 6 (n8n) — Task 8: outage, retry and duplicate-delivery
 * golden suite. Proves CRM state stays correct/canonical and delivery
 * failures stay CRM-observable under 8 failure scenarios, composing REAL
 * production functions from Tasks 1-6 (never a reimplementation):
 *
 *   - lib/automation/actions/n8n-webhook.ts (Task 3): the real
 *     `executeN8nWebhook`, which delegates to `deliverSignedWebhook`
 *     (call-webhook.ts) for fetch/anti-SSRF/HMAC/retry.
 *   - lib/mcp/auth.ts (Task 1/4): the real `validateBearerToken`,
 *     `ensureScope`, `ensureRole` — organizationId/role/scope resolution
 *     that gates every MCP tool call.
 *   - lib/mcp/tools/leads.ts (Task 4): the real `crmGetLead`/`crmUpdateLead`
 *     tool handlers, whose org filtering was already proven by Task 4's
 *     n8n-mcp-scope.test.ts.
 *   - lib/automation/engine.ts: the real `runAutomationForEvent`, the actual
 *     event_log consumer that dispatches automation actions AFTER the
 *     triggering CRM mutation already committed (never in the same
 *     transaction) and records success/failure in `automation_rule_runs`.
 *   - app/api/v1/webhooks/in/[token]/route.ts: the real generic inbound
 *     webhook receiver (explicitly documented as the n8n/Zapier integration
 *     path — see its own file comment) — HMAC verification and
 *     external_id-based idempotent redelivery.
 *
 * Same shared fixture/pattern as knowledge-publication-golden.test.ts and
 * graph-context-golden.test.ts: cases live in
 * tests/fixtures/ai-platform/golden-cases.json (rows n8n-*-037..044),
 * `pnpm ai:eval:local` only validates that fixture's shape/uniqueness, and
 * the real proof that each case's string is true is the function calls in
 * this file. All 8 new rows are stored with EMPTY `input_events` (same
 * precedent as graph-*-031..036): `scripts/ai-platform-eval-live.ts`'s
 * `populated` filter (`input_events.length > 0 || expect_zero_candidates`)
 * only ever exercises the Mem0 extraction pipeline, which has nothing to do
 * with n8n delivery/auth — keeping `input_events` empty makes it skip these
 * rows naturally instead of running unrelated real-cost API calls against
 * text that was never meant to be memory-extracted.
 *
 * Each scenario pairs a happy-path/control subtest (proves the gate isn't
 * vacuously always-failing) with a failure-mode subtest whose real,
 * captured output is checked against the golden case's
 * `expected.must_include`/`must_not_include` via `assertMatchesExpectation`
 * — the same helper/house-style as the two existing golden suites.
 */
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as LeadsHandlerModule from "@/app/api/v1/leads/_handler";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
// I3 fix: executeN8nWebhook now gates on the "n8n" AI Platform feature before
// delivering, which would otherwise call the real (mocked-to-undefined-return)
// createAdminClient() via resolveAiPlatformFeature's DB read. Every scenario
// in this file is about delivery/CRM-state behavior downstream of the gate,
// not the gate itself (that's covered by n8n-webhook.test.ts), so it's fixed
// to "on" here — same seam as n8n-webhook.test.ts/n8n-reference-workflow.test.ts.
vi.mock("@/lib/agent-engine/platform/features", () => ({
  resolveAiPlatformFeature: vi.fn().mockResolvedValue({ mode: "on", config: {}, killed: false }),
}));
vi.mock("@/app/api/v1/leads/_handler", async (importOriginal) => {
  const actual = await importOriginal<typeof LeadsHandlerModule>();
  return { ...actual, createLeadHandler: vi.fn() };
});

import { executeN8nWebhook } from "@/lib/automation/actions/n8n-webhook";
import { validateBearerToken, ensureScope, McpAuthError } from "@/lib/mcp/auth";
import { crmGetLead, crmUpdateLead } from "@/lib/mcp/tools/leads";
import { runAutomationForEvent } from "@/lib/automation/engine";
import type { ActionCtx } from "@/lib/automation/types";
import type { EventRow } from "@/lib/event-log/dispatcher";
import type { McpContext } from "@/lib/mcp/types";
import type { Actor } from "@/lib/api/handlers/types";
import { audit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLeadHandler } from "@/app/api/v1/leads/_handler";

// ---------------------------------------------------------------------------
// Shared fixture loading (same shape/helpers as knowledge-publication-golden
// / graph-context-golden).
// ---------------------------------------------------------------------------

interface GoldenCaseExpected {
  must_include: string[];
  must_not_include: string[];
  authority_domain: string;
  risk: string;
}
interface GoldenCase {
  id: string;
  organization_id: string;
  contact_id: string;
  input_events: unknown[];
  query: string;
  expected: GoldenCaseExpected;
}

const GOLDEN_CASES_PATH = join(__dirname, "..", "fixtures", "ai-platform", "golden-cases.json");

function loadGoldenCases(): GoldenCase[] {
  return JSON.parse(readFileSync(GOLDEN_CASES_PATH, "utf8")) as GoldenCase[];
}

function goldenCase(id: string): GoldenCase {
  const found = loadGoldenCases().find((candidate) => candidate.id === id);
  if (!found) throw new Error(`n8n-failure-golden: golden case not found: ${id}`);
  return found;
}

/** Checks a real captured outcome string against a golden case's expected substrings. */
function assertMatchesExpectation(text: string, expected: GoldenCaseExpected): void {
  for (const fragment of expected.must_include) {
    expect(text).toContain(fragment);
  }
  for (const fragment of expected.must_not_include) {
    expect(text).not.toContain(fragment);
  }
}

async function listen(server: Server): Promise<{ port: number; close: () => Promise<void> }> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { port, close: () => new Promise((resolve) => server.close(() => resolve())) };
}

function baseActionCtx(overrides: Partial<ActionCtx["event"]> = {}): ActionCtx {
  return {
    admin: {} as ActionCtx["admin"],
    organizationId: "org-1",
    ruleId: "rule-1",
    requestId: "req-1",
    event: {
      id: "evt-1",
      organization_id: "org-1",
      event_type: "lead.created",
      entity_kind: "crm_lead",
      entity_id: "lead-1",
      payload: { foo: "bar" },
      metadata: {},
      consumed_by: [],
      attempts: 0,
      ...overrides,
    },
    context: {},
  };
}

let server: Server | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
  vi.clearAllMocks();
});

// ===========================================================================
// Scenario 1: n8n 500 — CRM outbound delivery fails with 500; CRM state must
// be deterministic/retryable.
// ===========================================================================

describe("n8n 500: outbound delivery fails deterministically and is retryable", () => {
  it("controle positivo: 200 é registrado como success uma única vez", async () => {
    let hits = 0;
    server = createServer((req, res) => {
      hits += 1;
      req.resume();
      req.on("end", () => {
        res.writeHead(200);
        res.end("ok");
      });
    });
    const { port, close } = await listen(server);

    const result = await executeN8nWebhook(
      baseActionCtx(),
      { url: `http://127.0.0.1:${port}/hook`, workflow_key: "wf-1" },
      { skipUrlCheck: true },
    );

    expect(result.status).toBe("success");
    expect(hits).toBe(1);
    await close();
  });

  it("500 persistente: failed, retryable, todas as tentativas contabilizadas (golden n8n-outage-500-037)", async () => {
    let hits = 0;
    server = createServer((req, res) => {
      hits += 1;
      req.resume();
      req.on("end", () => {
        res.writeHead(500);
        res.end("nope");
      });
    });
    const { port, close } = await listen(server);

    const result = await executeN8nWebhook(
      baseActionCtx(),
      { url: `http://127.0.0.1:${port}/hook`, workflow_key: "wf-1" },
      { skipUrlCheck: true, retryDelaysMs: [1, 1] },
    );

    expect(hits).toBe(3);
    const outcome = `status=${result.status} error=${result.error} http=${result.detail?.response_status} attempts=${result.detail?.attempts}`;
    assertMatchesExpectation(outcome, goldenCase("n8n-outage-500-037").expected);

    await close();
  }, 15_000);
});

// ===========================================================================
// Scenario 2: timeout — idempotency key must allow re-delivery without
// duplicate external effect.
// ===========================================================================

describe("timeout: idempotency key allows re-delivery without duplicate external effect", () => {
  it("controle positivo: entrega única a alvo alcançável dispara o efeito externo exatamente uma vez", async () => {
    let effectCount = 0;
    server = createServer((req, res) => {
      effectCount += 1;
      req.resume();
      req.on("end", () => {
        res.writeHead(200);
        res.end("ok");
      });
    });
    const { port, close } = await listen(server);

    const result = await executeN8nWebhook(
      baseActionCtx(),
      { url: `http://127.0.0.1:${port}/hook`, workflow_key: "wf-1" },
      { skipUrlCheck: true },
    );

    expect(result.status).toBe("success");
    expect(effectCount).toBe(1);
    await close();
  });

  it("timeout seguido de redelivery pela mesma idempotency_key: alvo dedupe-por-chave nunca duplica o efeito (golden n8n-timeout-idempotent-redelivery-038)", async () => {
    // 1) Primeira tentativa: porta sem listener (connection-refused, mesma
    //    classificação de retry que um AbortError de timeout real —
    //    deliverSignedWebhook trata os dois no mesmo catch).
    const timedOut = await executeN8nWebhook(
      baseActionCtx(),
      { url: "http://127.0.0.1:9/hook", workflow_key: "wf-1" },
      { skipUrlCheck: true, retryDelaysMs: [1, 1] },
    );
    expect(timedOut.status).toBe("failed");

    // 2) Redelivery (retry manual/automático de operação): alvo alcançável
    //    que simula a deduplicação durável do lado n8n (Task 6's contrato:
    //    "add n8n-side durable deduplication ... not process memory") —
    //    aqui, um Set representando esse armazenamento persistente.
    const seenKeys = new Set<string>();
    let effectCount = 0;
    const receivedKeys: string[] = [];
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { idempotency_key: string };
        receivedKeys.push(body.idempotency_key);
        if (!seenKeys.has(body.idempotency_key)) {
          seenKeys.add(body.idempotency_key);
          effectCount += 1;
        }
        res.writeHead(200);
        res.end("ok");
      });
    });
    const { port, close } = await listen(server);
    const config = { url: `http://127.0.0.1:${port}/hook`, workflow_key: "wf-1" };

    const r1 = await executeN8nWebhook(baseActionCtx(), config, { skipUrlCheck: true });
    const r2 = await executeN8nWebhook(baseActionCtx(), config, { skipUrlCheck: true });

    expect(r1.status).toBe("success");
    expect(r2.status).toBe("success");
    expect(receivedKeys).toHaveLength(2);

    const outcome = `externalEffectCount=${effectCount} sameKey=${receivedKeys[0] === receivedKeys[1]}`;
    assertMatchesExpectation(outcome, goldenCase("n8n-timeout-idempotent-redelivery-038").expected);

    await close();
  }, 15_000);
});

// ===========================================================================
// Scenario 3: webhook delivered twice — n8n delivers the same inbound
// payload twice (network retransmit or double-fire); idempotency must
// de-dupe on the CRM side, via the generic inbound webhook receiver's
// external_id fast path (app/api/v1/webhooks/in/[token]/route.ts).
// ===========================================================================

describe("webhook delivered twice (inbound): CRM-side external_id dedupe never creates a second lead", () => {
  const TOKEN = "test-webhook-token-12345";
  const SOURCE_ID = "src-1";
  const ORG_ID = "org-webhook-1";
  const EXTERNAL_ID = "n8n-run-abc-123";
  const EXISTING_LEAD_ID = "lead-existing-1";

  function makeRouteAdmin(opts: { existingLeadForExternalId: string | null }) {
    const eventsLogInsert = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
    const chain = {
      from(table: string) {
        if (table === "webhook_sources") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: SOURCE_ID,
                    organization_id: ORG_ID,
                    secret_encrypted: null,
                    default_pipeline_id: "pipe-1",
                    default_stage_id: "stage-1",
                    field_map: {},
                    redirect_to: null,
                    is_active: true,
                  },
                  error: null,
                }),
              }),
            }),
            // last_received_at bookkeeping, fire-and-forget-shaped but
            // awaited by the route after a lead is created.
            update: () => ({ eq: async () => ({ error: null }) }),
          };
        }
        if (table === "webhook_events_log") {
          return { insert: eventsLogInsert };
        }
        if (table === "crm_leads") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: opts.existingLeadForExternalId ? { id: opts.existingLeadForExternalId } : null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "webhook_sources_update_stub") return {} as never;
        throw new Error(`n8n-failure-golden: stub de teste não cobre a tabela "${table}"`);
      },
    };
    return { admin: chain, eventsLogInsert };
  }

  function postReq(body: Record<string, unknown>) {
    return new NextRequest(`http://localhost/api/v1/webhooks/in/${TOKEN}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, count: 1, limit: 60, window_sec: 60 } as never);
  });

  it("controle positivo: external_id inédito segue para createLeadHandler (não é tratado como duplicado)", async () => {
    const { admin } = makeRouteAdmin({ existingLeadForExternalId: null });
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
    vi.mocked(createLeadHandler).mockResolvedValue({ id: "brand-new-lead" } as never);

    const { POST } = await import("@/app/api/v1/webhooks/in/[token]/route");
    // Sem `phone`: evita a ramificação de upsert de `contacts` (fora do
    // escopo deste stub), mantendo o cenário focado no fast-path de dedupe
    // por external_id que este describe existe para provar.
    const res = await POST(postReq({ name: "Fulano", email: "fulano@example.com", external_id: "novo-external-id" }), {
      params: Promise.resolve({ token: TOKEN }),
    });

    expect(res.status).toBe(200);
    expect(createLeadHandler).toHaveBeenCalledTimes(1);
  });

  it("mesmo external_id entregue duas vezes: 200 idempotente com o lead JÁ existente, createLeadHandler NUNCA chamado (golden n8n-inbound-duplicate-delivery-039)", async () => {
    const { admin } = makeRouteAdmin({ existingLeadForExternalId: EXISTING_LEAD_ID });
    vi.mocked(createAdminClient).mockReturnValue(admin as never);

    const { POST } = await import("@/app/api/v1/webhooks/in/[token]/route");
    const res = await POST(postReq({ name: "Fulano", phone: "11988887777", external_id: EXTERNAL_ID }), {
      params: Promise.resolve({ token: TOKEN }),
    });
    const json = (await res.json()) as { data?: { lead_id?: string } };

    expect(res.status).toBe(200);
    expect(json.data?.lead_id).toBe(EXISTING_LEAD_ID);

    const outcome = `createLeadCalled=${vi.mocked(createLeadHandler).mock.calls.length}`;
    assertMatchesExpectation(outcome, goldenCase("n8n-inbound-duplicate-delivery-039").expected);
  });
});

// ===========================================================================
// Scenario 4: retry after worker/process restart — idempotency key is
// derived purely from persisted identifiers (rule id + event id), never
// from in-process state, so a "cold" second call (fresh ctx object, no
// shared references) after a simulated restart reuses the identical key.
// ===========================================================================

describe("retry after worker/process restart: idempotency key survives, derived only from persisted identifiers", () => {
  it("controle positivo: uma única entrega (sem restart) produz uma key determinística e não vazia", async () => {
    let received: string | undefined;
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        received = JSON.parse(Buffer.concat(chunks).toString("utf8")).idempotency_key;
        res.writeHead(200);
        res.end("ok");
      });
    });
    const { port, close } = await listen(server);

    const result = await executeN8nWebhook(
      baseActionCtx(),
      { url: `http://127.0.0.1:${port}/hook`, workflow_key: "wf-1" },
      { skipUrlCheck: true },
    );

    expect(result.status).toBe("success");
    expect(typeof received).toBe("string");
    expect(received!.length).toBeGreaterThan(0);
    await close();
  });

  it("restart simulado (ctx totalmente novo, sem estado de processo compartilhado) reproduz a MESMA idempotency_key (golden n8n-outbound-restart-retry-040)", async () => {
    const receivedKeys: string[] = [];
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        receivedKeys.push(JSON.parse(Buffer.concat(chunks).toString("utf8")).idempotency_key);
        res.writeHead(200);
        res.end("ok");
      });
    });
    const { port, close } = await listen(server);
    const config = { url: `http://127.0.0.1:${port}/hook`, workflow_key: "wf-1" };

    // "Antes do restart": worker original monta um ctx e entrega parcialmente.
    const ctxBeforeRestart = baseActionCtx({ id: "evt-persisted-1" });
    const beforeRestart = await executeN8nWebhook(ctxBeforeRestart, config, { skipUrlCheck: true });
    expect(beforeRestart.status).toBe("success");

    // "Depois do restart": processo novo, NENHUMA referência de objeto
    // compartilhada com ctxBeforeRestart — só o event.id e o ruleId, que
    // vieram de linhas persistidas (event_log/automation_rules), sobrevivem.
    const ctxAfterRestart = baseActionCtx({ id: "evt-persisted-1" });
    expect(ctxAfterRestart).not.toBe(ctxBeforeRestart);
    const afterRestart = await executeN8nWebhook(ctxAfterRestart, config, { skipUrlCheck: true });
    expect(afterRestart.status).toBe("success");

    expect(receivedKeys).toHaveLength(2);
    const outcome = `sameKeyAcrossRestart=${receivedKeys[0] === receivedKeys[1]}`;
    assertMatchesExpectation(outcome, goldenCase("n8n-outbound-restart-retry-040").expected);

    await close();
  });
});

// ===========================================================================
// Scenario 5: invalid HMAC — n8n payload arrives at CRM's generic inbound
// webhook receiver with the wrong signature; must fail closed BEFORE any
// business-table write.
// ===========================================================================

describe("invalid HMAC (inbound): fails closed before CRM processes the payload", () => {
  const TOKEN = "hmac-test-token-99999";
  const ORG_ID = "org-hmac-1";
  const SECRET = "n8n-inbound-shared-secret-16chars";

  function makeAdmin() {
    const eventsLogInsert = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
    const admin = {
      from(table: string) {
        if (table === "webhook_sources") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "src-hmac-1",
                    organization_id: ORG_ID,
                    secret_encrypted: "\\xdeadbeef",
                    default_pipeline_id: "pipe-1",
                    default_stage_id: "stage-1",
                    field_map: {},
                    redirect_to: null,
                    is_active: true,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "webhook_events_log") return { insert: eventsLogInsert };
        throw new Error(`n8n-failure-golden: stub de teste não cobre a tabela "${table}" neste cenário`);
      },
      rpc: async () => ({ data: SECRET, error: null }),
    };
    return { admin, eventsLogInsert };
  }

  function postReq(rawBody: string, signature: string | null) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (signature) headers["x-deskcomm-signature"] = signature;
    return new NextRequest(`http://localhost/api/v1/webhooks/in/${TOKEN}`, {
      method: "POST",
      headers,
      body: rawBody,
    });
  }

  beforeEach(() => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, count: 1, limit: 60, window_sec: 60 } as never);
  });

  it("controle positivo: assinatura VÁLIDA não é rejeitada com 401 e o recebimento é logado", async () => {
    const { admin, eventsLogInsert } = makeAdmin();
    vi.mocked(createAdminClient).mockReturnValue(admin as never);

    const rawBody = JSON.stringify({ ping: "sem campo mapeável de propósito, pra não precisar de createLeadHandler" });
    const validSig = createHmac("sha256", SECRET).update(rawBody).digest("hex");

    const { POST } = await import("@/app/api/v1/webhooks/in/[token]/route");
    const res = await POST(postReq(rawBody, validSig), { params: Promise.resolve({ token: TOKEN }) });

    expect(res.status).not.toBe(401);
    expect(eventsLogInsert).toHaveBeenCalledTimes(1);
    const insertedRow = eventsLogInsert.mock.calls[0]![0] as { valid_signature: boolean };
    expect(insertedRow.valid_signature).toBe(true);
  });

  it("assinatura INVÁLIDA: 401 antes de logar o recebimento ou tocar qualquer tabela de negócio (golden n8n-inbound-invalid-hmac-041)", async () => {
    const { admin, eventsLogInsert } = makeAdmin();
    vi.mocked(createAdminClient).mockReturnValue(admin as never);

    const rawBody = JSON.stringify({ name: "Forjado" });
    const res = await (
      await import("@/app/api/v1/webhooks/in/[token]/route")
    ).POST(postReq(rawBody, "0000deadbeef0000invalidsignature"), { params: Promise.resolve({ token: TOKEN }) });

    expect(res.status).toBe(401);
    expect(eventsLogInsert).not.toHaveBeenCalled();
    expect(vi.mocked(audit)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(audit).mock.calls[0]![0]).toMatchObject({ action: "webhook.inbound_invalid_signature" });

    const outcome = `status=${res.status} eventsLogInsertCalled=${eventsLogInsert.mock.calls.length}`;
    assertMatchesExpectation(outcome, goldenCase("n8n-inbound-invalid-hmac-041").expected);
  });
});

// ===========================================================================
// Scenario 6: revoked CRM token — n8n tries to auth with a revoked
// api_tokens row; must fail closed BEFORE any MCP tool handler runs.
// ===========================================================================

describe("revoked CRM token (inbound MCP): fails closed before any tool handler runs", () => {
  const TOKEN_ID = "tok-n8n-1";
  const ORG_ID = "22222222-2222-4222-8222-222222222222";
  const PLAINTEXT = "dsk_n8nworkflow_secret456";

  function makeAdminStub(row: Record<string, unknown> | null) {
    const chain = {
      select: () => chain,
      eq: () => chain,
      update: () => chain,
      maybeSingle: () => Promise.resolve({ data: row, error: null }),
      then: (resolve: (v: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    return { from: () => chain };
  }

  /** Mesma ordem que lib/mcp/server.ts aplica: auth resolve ANTES de qualquer tool rodar. */
  async function handleMcpRequest(authHeader: string | null, toolHandler: () => Promise<unknown>): Promise<{
    httpStatus: number;
    toolRan: boolean;
  }> {
    let auth;
    try {
      auth = await validateBearerToken(authHeader);
    } catch (err) {
      const status = err instanceof McpAuthError ? err.httpStatus : 500;
      return { httpStatus: status, toolRan: false };
    }
    ensureScope(auth.scopes, "mcp:read");
    await toolHandler();
    return { httpStatus: 200, toolRan: true };
  }

  it("controle positivo: token válido (não revogado) autentica e a tool RODA", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeAdminStub({
        id: TOKEN_ID,
        organization_id: ORG_ID,
        scopes: ["mcp:read", "role:agent"],
        revoked_at: null,
        expires_at: null,
      }) as never,
    );
    const toolHandler = vi.fn(async () => ({ ok: true }));

    const result = await handleMcpRequest(`Bearer ${PLAINTEXT}`, toolHandler);

    expect(result.httpStatus).toBe(200);
    expect(result.toolRan).toBe(true);
    expect(toolHandler).toHaveBeenCalledTimes(1);
  });

  it("token revogado: 401 e a tool NUNCA roda (golden n8n-inbound-revoked-token-042)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeAdminStub({
        id: TOKEN_ID,
        organization_id: ORG_ID,
        scopes: ["mcp:read", "role:agent"],
        revoked_at: new Date().toISOString(),
        expires_at: null,
      }) as never,
    );
    const toolHandler = vi.fn(async () => ({ ok: true }));

    const result = await handleMcpRequest(`Bearer ${PLAINTEXT}`, toolHandler);

    expect(result.httpStatus).toBe(401);
    expect(result.toolRan).toBe(false);
    expect(toolHandler).not.toHaveBeenCalled();

    const outcome = `authHttpStatus=${result.httpStatus} toolHandlerCalled=${toolHandler.mock.calls.length}`;
    assertMatchesExpectation(outcome, goldenCase("n8n-inbound-revoked-token-042").expected);
  });
});

// ===========================================================================
// Scenario 7: n8n attempts cross-tenant write — payload references org B's
// lead while the token is scoped to org A; must fail or leave org B's data
// unaffected (never partially mutated).
// ===========================================================================

describe("cross-tenant write attempt: org A token cannot mutate org B's real lead, org B stays untouched", () => {
  const ORG_A = "11111111-1111-4111-8111-111111111111";
  const ORG_B = "22222222-2222-4222-8222-222222222222";
  const LEAD_IN_ORG_A = "33333333-3333-4333-8333-333333333333";
  const LEAD_IN_ORG_B = "44444444-4444-4444-8444-444444444444";
  const ORIGINAL_ORG_B_TITLE = "Lead da org B — não deveria ser editado pela org A";

  function makeCrmLeadsStub(rows: Array<Record<string, unknown>>) {
    return {
      // updateLeadHandler dispara um RPC de emissão de evento fire-and-forget
      // (.then(), nunca await) após a mutação — resolve-o benignamente para
      // não estourar "supabase.rpc is not a function".
      rpc: () => Promise.resolve({ error: null }),
      from(table: string) {
        if (table !== "crm_leads") throw new Error(`stub de teste não cobre a tabela "${table}"`);
        const filters: Record<string, unknown> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chain: any = {
          select: () => chain,
          update: (patch: Record<string, unknown>) => {
            const target = rows.find((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
            if (target) Object.assign(target, patch);
            return chain;
          },
          eq: (col: string, val: unknown) => {
            filters[col] = val;
            return chain;
          },
          order: () => chain,
          limit: () => chain,
          maybeSingle: () =>
            Promise.resolve({
              data: rows.find((r) => Object.entries(filters).every(([k, v]) => r[k] === v)) ?? null,
              error: null,
            }),
        };
        return chain;
      },
    };
  }

  function ctxForOrgA(supabase: unknown): McpContext {
    const actor: Actor = { type: "ai_agent", id: "n8n-run-1", role: "agent" };
    return {
      organizationId: ORG_A,
      role: "agent",
      actor,
      apiTokenId: "tok-n8n-org-a",
      requestId: "req-n8n-cross-tenant",
      supabase: supabase as McpContext["supabase"],
    };
  }

  function updatePayload(leadId: string, title: string) {
    return {
      lead_id: leadId,
      title,
      description: undefined,
      contact_id: undefined,
      value_cents: undefined,
      currency: undefined,
      owner_user_id: undefined,
      owner_agent_id: undefined,
      expected_close_date: undefined,
      tags: undefined,
    };
  }

  it("controle positivo: token da org A escreve com sucesso no PRÓPRIO lead (org A)", async () => {
    const rows = [
      { id: LEAD_IN_ORG_A, organization_id: ORG_A, title: "Original", pipeline_id: "p", stage_id: null, owner_user_id: null, status: "open" },
    ];
    const supabase = makeCrmLeadsStub(rows);
    const ctx = ctxForOrgA(supabase);

    await crmUpdateLead.handler(updatePayload(LEAD_IN_ORG_A, "Atualizado pela própria org"), ctx);

    expect(rows[0]!.title).toBe("Atualizado pela própria org");
  });

  it("token da org A tenta escrever no lead_id REAL da org B: rejeitado E org B permanece com o título original, sem mutação parcial (golden n8n-inbound-cross-tenant-write-043)", async () => {
    const rows = [
      { id: LEAD_IN_ORG_B, organization_id: ORG_B, title: ORIGINAL_ORG_B_TITLE, pipeline_id: "p-b", stage_id: null, owner_user_id: null, status: "open" },
    ];
    const supabase = makeCrmLeadsStub(rows);
    const ctx = ctxForOrgA(supabase);

    let rejected = false;
    try {
      await crmUpdateLead.handler(updatePayload(LEAD_IN_ORG_B, "Sequestrado pela org A"), ctx);
    } catch (err) {
      rejected = true;
      expect(err).toMatchObject({ status: 404 });
    }

    expect(rejected).toBe(true);
    const orgBTitleUnchanged = rows[0]!.title === ORIGINAL_ORG_B_TITLE;
    expect(orgBTitleUnchanged).toBe(true);

    const outcome = `writeRejected=${rejected} orgBTitleUnchanged=${orgBTitleUnchanged}`;
    assertMatchesExpectation(outcome, goldenCase("n8n-inbound-cross-tenant-write-043").expected);
  });

  it("bônus (mesma propriedade, leitura): crm_get_lead também não vaza o lead da org B pro token da org A", async () => {
    const rows = [{ id: LEAD_IN_ORG_B, organization_id: ORG_B, title: ORIGINAL_ORG_B_TITLE, pipeline_id: "p-b", stage_id: null, owner_user_id: null, status: "open" }];
    const supabase = makeCrmLeadsStub(rows);
    const ctx = ctxForOrgA(supabase);

    await expect(crmGetLead.handler({ lead_id: LEAD_IN_ORG_B }, ctx)).rejects.toMatchObject({ status: 404 });
  });
});

// ===========================================================================
// Scenario 8: n8n unavailable while CRM state transition succeeds — CRM
// state is canonical (already committed, never rolled back), n8n lag is
// observable/transparent via automation_rule_runs + audit, never a silent
// divergence. Composes the REAL event_log consumer (lib/automation/engine.ts)
// exactly as workers/event-log dispatch it — the automation action runs
// AFTER the triggering mutation already committed, never in its transaction.
// ===========================================================================

describe("n8n unavailable while CRM state transition already succeeded: CRM state stays canonical, failure stays observable", () => {
  const ORG_ID = "org-engine-1";
  const RULE_ID = "rule-n8n-1";
  const LEAD_ID = "lead-engine-1";
  /** Representa o stage_id JÁ commitado pela mutação real antes deste evento existir. */
  const COMMITTED_STAGE = "stage-new-committed";

  interface EngineState {
    rules: Array<{ id: string; name: string; conditions: unknown[]; actions: Array<{ type: string; config: Record<string, unknown> }> }>;
    leadRow: Record<string, unknown>;
    runsInserted: Array<Record<string, unknown>>;
    runCount: number;
  }

  function makeEngineAdmin(state: EngineState) {
    return {
      from(table: string) {
        if (table === "automation_rules") {
          return {
            select: (cols: string) => {
              if (typeof cols === "string" && cols.includes("run_count")) {
                return { eq: () => ({ maybeSingle: async () => ({ data: { run_count: state.runCount }, error: null }) }) };
              }
              return {
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      order: async () => ({ data: state.rules, error: null }),
                    }),
                  }),
                }),
              };
            },
            update: (patch: Record<string, unknown>) => ({
              eq: async () => {
                state.runCount = (patch.run_count as number) ?? state.runCount;
                return { error: null };
              },
            }),
          };
        }
        if (table === "crm_leads") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: state.leadRow, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "automation_rule_runs") {
          return {
            insert: (row: Record<string, unknown>) => {
              state.runsInserted.push(row);
              return { select: () => ({ maybeSingle: async () => ({ data: { id: "run-1" }, error: null }) }) };
            },
          };
        }
        throw new Error(`n8n-failure-golden (engine): stub de teste não cobre a tabela "${table}"`);
      },
    };
  }

  function eventRow(overrides: Partial<EventRow> = {}): EventRow {
    return {
      id: "evt-engine-1",
      organization_id: ORG_ID,
      event_type: "lead.stage_changed",
      entity_kind: "crm_lead",
      entity_id: LEAD_ID,
      payload: {},
      metadata: {},
      consumed_by: [],
      attempts: 0,
      ...overrides,
    };
  }

  beforeEach(async () => {
    // Garante que o executor n8n_webhook está registrado no motor real antes
    // de runAutomationForEvent tentar getAction("n8n_webhook") — mesma
    // importação de side-effect usada pelo teste de wiring do Task 3.
    await import("@/lib/automation/actions/register-all");
  });

  it("controle positivo: n8n alcançável -> run 'success', audit NÃO chamado (audit só dispara em falha/partial)", async () => {
    // engine.ts nunca passa skipUrlCheck ao invocar uma action (chama
    // executor.execute(ctx, config) com só 2 argumentos) — o dispatch REAL
    // sempre roda assertSafeOutboundUrl, que bloqueia 127.0.0.1/localhost
    // incondicionalmente (lib/automation/outbound-url.ts). Por isso este
    // controle usa host público + fetch mockado (mesmo precedente de
    // n8n-integration-boundary.test.ts), não um servidor local.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200 } as Response);

    const state: EngineState = {
      rules: [{ id: RULE_ID, name: "n8n on stage change", conditions: [], actions: [{ type: "n8n_webhook", config: { url: "https://n8n-workflow.example.com/hook", workflow_key: "wf-1" } }] }],
      leadRow: { id: LEAD_ID, organization_id: ORG_ID, stage_id: COMMITTED_STAGE, contact_id: null },
      runsInserted: [],
      runCount: 0,
    };
    const admin = makeEngineAdmin(state);

    const result = await runAutomationForEvent(admin as never, eventRow());

    expect(result.status).toBe("ok");
    expect(state.runsInserted).toHaveLength(1);
    expect(state.runsInserted[0]!.status).toBe("success");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(vi.mocked(audit)).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("n8n indisponível: run 'failed' é gravado (observável), CRM.state (stage_id) permanece o já-commitado, sem rollback silencioso (golden n8n-outbound-unavailable-state-canonical-044)", async () => {
    const state: EngineState = {
      rules: [
        {
          id: RULE_ID,
          name: "n8n on stage change",
          conditions: [],
          // Host privado: assertSafeOutboundUrl barra ANTES de qualquer fetch
          // — determinístico e rápido, mesma classificação de falha
          // ("n8n indisponível") sem depender de timeout de rede real.
          actions: [{ type: "n8n_webhook", config: { url: "http://127.0.0.1:9/hook", workflow_key: "wf-1" } }],
        },
      ],
      leadRow: { id: LEAD_ID, organization_id: ORG_ID, stage_id: COMMITTED_STAGE, contact_id: null },
      runsInserted: [],
      runCount: 0,
    };
    const admin = makeEngineAdmin(state);

    const result = await runAutomationForEvent(admin as never, eventRow());

    expect(result.status).toBe("ok");
    expect(state.runsInserted).toHaveLength(1);
    const run = state.runsInserted[0]! as { status: string; actions_result: Array<{ status: string }> };
    expect(run.status).toBe("failed");
    expect(run.actions_result[0]!.status).toBe("failed");
    expect(vi.mocked(audit)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(audit).mock.calls[0]![0]).toMatchObject({ action: "automation.rule_executed" });

    // A prova central do cenário: o estado do CRM (stage_id) já estava
    // commitado ANTES deste evento ser processado (buildContext apenas leu
    // a row real) e continua exatamente o mesmo — a falha do n8n nunca
    // reverte nem esconde essa mutação.
    expect(state.leadRow.stage_id).toBe(COMMITTED_STAGE);

    const outcome = `runStatus=${run.status} leadStageAfter=${state.leadRow.stage_id}`;
    assertMatchesExpectation(outcome, goldenCase("n8n-outbound-unavailable-state-canonical-044").expected);
  });
});
