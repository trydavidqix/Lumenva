/**
 * AI Platform Phase 6 (n8n) — Task 4: prova as bordas de menor privilégio que
 * `docs/runbooks/n8n-token.md` promete para um bearer token provisionado a um
 * workflow n8n.
 *
 * Três propriedades, três seções:
 *
 *   1. Um token com o scope read-only recomendado pelo runbook (`mcp:read` +
 *      `role:agent`) não pode invocar NENHUMA tool write/handoff do catálogo
 *      real — via `ensureScope`, o mesmo gate que `lib/mcp/server.ts` chama
 *      antes de rodar qualquer handler.
 *   2. Um token com `mcp:write` mas role default (`role:agent` — nunca
 *      `role:admin` como conveniência, doutrina do runbook) não ultrapassa o
 *      role mínimo de nenhuma tool manager-only — via `ensureRole`, na mesma
 *      ordem que `lib/mcp/server.ts` aplica (ensureScope primeiro, depois
 *      ensureRole).
 *   3. Um token da org A não lê nem edita um lead da org B mesmo que o
 *      payload MCP carregue um `lead_id` real pertencente à org B —
 *      `crm_get_lead`/`crm_update_lead` (lib/mcp/tools/leads.ts) delegam
 *      para `getLeadHandler`/`updateLeadHandler` (app/api/v1/leads/_handler.ts),
 *      que filtram toda query por `ctx.organization_id` (derivado SÓ do
 *      token — invariante já travado por
 *      tests/unit/n8n-integration-boundary.test.ts) e nunca por um campo
 *      vindo do body.
 *
 * Não reimplementa a fronteira já provada pela Task 1
 * (n8n-integration-boundary.test.ts, que trava validateBearerToken e o
 * catálogo de tools em abstrato). Aqui o alvo é: (a) o par scope+role
 * concreto que o runbook recomenda provisionar, aplicado a TODO o catálogo
 * real hoje, e (b) a superfície de recurso (lead_id cross-org), que a Task 1
 * não cobre.
 */
import { describe, expect, it } from "vitest";

import { ensureScope, ensureRole, McpAuthError } from "@/lib/mcp/auth";
import { allTools, getToolByName } from "@/lib/mcp/tools";
import { crmGetLead, crmUpdateLead } from "@/lib/mcp/tools/leads";
import type { McpContext } from "@/lib/mcp/types";
import type { Actor } from "@/lib/api/handlers/types";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const LEAD_IN_ORG_A = "33333333-3333-4333-8333-333333333333";
const LEAD_IN_ORG_B = "44444444-4444-4444-8444-444444444444";

/** Default read-only recomendado pelo runbook (docs/runbooks/n8n-token.md). */
const READ_ONLY_SCOPES = ["mcp:read", "role:agent"];
/** Default de escrita recomendado: mcp:write + role:agent — NUNCA role:admin. */
const WRITE_AGENT_SCOPES = ["mcp:write", "role:agent"];

// ---------------------------------------------------------------------------
// Stub mínimo de crm_leads: só entende `.eq(...)` acumulado + `maybeSingle()`.
// Se o handler tocar outra tabela, o stub estoura — nenhuma leitura oculta
// passa despercebida.
// ---------------------------------------------------------------------------
function makeCrmLeadsStub(rows: Array<Record<string, unknown>>) {
  return {
    from(table: string) {
      if (table !== "crm_leads") {
        throw new Error(`stub de teste não cobre a tabela "${table}"`);
      }
      const filters: Record<string, unknown> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        select: () => chain,
        update: () => chain,
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: () =>
          Promise.resolve({
            data:
              rows.find((r) => Object.entries(filters).every(([k, v]) => r[k] === v)) ?? null,
            error: null,
          }),
      };
      return chain;
    },
  };
}

function ctxForOrgA(supabase: unknown): McpContext {
  const actor: Actor = { type: "ai_agent", id: "run-1", role: "agent" };
  return {
    organizationId: ORG_A,
    role: "agent",
    actor,
    apiTokenId: "tok-org-a",
    requestId: "req-org-a-vs-org-b",
    supabase: supabase as McpContext["supabase"],
  };
}

// ---------------------------------------------------------------------------
// 1. Read-only token (mcp:read) não invoca tool write/handoff nenhuma.
// ---------------------------------------------------------------------------

describe("token read-only (mcp:read, role:agent — default do runbook) não chama tool de escrita", () => {
  it("guarda de vacuidade: existe pelo menos uma tool write/handoff no catálogo real", () => {
    const writeTools = allTools.filter((t) => t.category === "write" || t.category === "handoff");
    expect(writeTools.length).toBeGreaterThan(0);
  });

  it("ensureScope barra TODA tool write/handoff do catálogo real para um token só com mcp:read", () => {
    const writeTools = allTools.filter((t) => t.category === "write" || t.category === "handoff");
    for (const tool of writeTools) {
      expect(() => ensureScope(READ_ONLY_SCOPES, tool.requiresScope)).toThrow(McpAuthError);
    }
  });

  it("comportamental: exemplo concreto — crm_create_lead (write) rejeita token read-only com 403", () => {
    const tool = getToolByName("crm_create_lead");
    expect(tool).toBeDefined();
    try {
      ensureScope(READ_ONLY_SCOPES, tool!.requiresScope);
      throw new Error("deveria ter lançado");
    } catch (err) {
      expect(err).toBeInstanceOf(McpAuthError);
      expect((err as McpAuthError).httpStatus).toBe(403);
    }
  });

  it("controle positivo: o mesmo token read-only passa ensureScope em toda tool que só exige mcp:read (o gate não está travado sempre-falha)", () => {
    const readScopeTools = allTools.filter((t) => t.requiresScope === "mcp:read");
    expect(readScopeTools.length).toBeGreaterThan(0);
    for (const tool of readScopeTools) {
      expect(() => ensureScope(READ_ONLY_SCOPES, tool.requiresScope)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Write token com role default (agent) não ultrapassa tool manager-only.
// ---------------------------------------------------------------------------

describe("token write com role:agent (default do runbook — nunca role:admin) não ultrapassa a role mínima", () => {
  it("guarda de vacuidade: existe pelo menos uma tool manager-only no catálogo real", () => {
    const managerTools = allTools.filter((t) => t.requiresRole === "manager");
    expect(managerTools.length).toBeGreaterThan(0);
  });

  it("scope passa (mcp:write presente) mas ensureRole barra toda tool manager-only para role:agent", () => {
    const managerTools = allTools.filter((t) => t.requiresRole === "manager");
    for (const tool of managerTools) {
      expect(() => ensureScope(WRITE_AGENT_SCOPES, tool.requiresScope)).not.toThrow();
      expect(() => ensureRole("agent", tool.requiresRole)).toThrow(McpAuthError);
    }
  });

  it("comportamental: exemplo concreto — crm_create_stage (role:manager) rejeita role:agent com 403, na mesma ordem de lib/mcp/server.ts (ensureScope, depois ensureRole)", () => {
    const tool = getToolByName("crm_create_stage");
    expect(tool).toBeDefined();
    expect(() => ensureScope(WRITE_AGENT_SCOPES, tool!.requiresScope)).not.toThrow();
    try {
      ensureRole("agent", tool!.requiresRole);
      throw new Error("deveria ter lançado");
    } catch (err) {
      expect(err).toBeInstanceOf(McpAuthError);
      expect((err as McpAuthError).httpStatus).toBe(403);
    }
  });

  it("controle positivo: role:manager passa ensureRole nas mesmas tools manager-only (o gate não está travado sempre-falha)", () => {
    const managerTools = allTools.filter((t) => t.requiresRole === "manager");
    for (const tool of managerTools) {
      expect(() => ensureRole("manager", tool.requiresRole)).not.toThrow();
    }
  });

  it("nenhuma tool do catálogo real exige role:admin — o runbook nunca precisa emitir token role:admin para n8n", () => {
    const adminTools = allTools.filter((t) => t.requiresRole === "admin");
    expect(adminTools).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Token da org A não age sobre a org B mesmo com lead_id real da org B.
// ---------------------------------------------------------------------------

describe("token da org A não lê nem edita lead da org B mesmo com lead_id real no payload", () => {
  it("controle positivo: crm_get_lead resolve um lead REAL da própria org (o stub não está sempre-vazio)", async () => {
    const supabase = makeCrmLeadsStub([
      {
        id: LEAD_IN_ORG_A,
        organization_id: ORG_A,
        title: "Lead da org A",
        pipeline_id: "pipe-a",
        stage_id: null,
        owner_user_id: null,
        status: "open",
      },
    ]);
    const ctx = ctxForOrgA(supabase);
    const result = (await crmGetLead.handler({ lead_id: LEAD_IN_ORG_A }, ctx)) as {
      lead: Record<string, unknown>;
    };
    expect(result.lead.id).toBe(LEAD_IN_ORG_A);
  });

  it("crm_get_lead: token da org A não lê o lead_id real de uma org B (404, sem vazar a linha)", async () => {
    const supabase = makeCrmLeadsStub([
      {
        id: LEAD_IN_ORG_B,
        organization_id: ORG_B,
        title: "Lead da org B — não deveria ser lido pela org A",
        pipeline_id: "pipe-b",
        stage_id: null,
        owner_user_id: null,
        status: "open",
      },
    ]);
    const ctx = ctxForOrgA(supabase);
    await expect(crmGetLead.handler({ lead_id: LEAD_IN_ORG_B }, ctx)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("crm_update_lead: token da org A não edita o lead_id real de uma org B (404, sem mutação)", async () => {
    const supabase = makeCrmLeadsStub([
      {
        id: LEAD_IN_ORG_B,
        organization_id: ORG_B,
        title: "Lead da org B — não deveria ser editado pela org A",
        pipeline_id: "pipe-b",
        stage_id: null,
        owner_user_id: null,
        status: "open",
      },
    ]);
    const ctx = ctxForOrgA(supabase);
    await expect(
      crmUpdateLead.handler(
        {
          lead_id: LEAD_IN_ORG_B,
          title: "Sequestrado pela org A",
          description: undefined,
          contact_id: undefined,
          value_cents: undefined,
          currency: undefined,
          owner_user_id: undefined,
          owner_agent_id: undefined,
          expected_close_date: undefined,
          tags: undefined,
        },
        ctx,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
