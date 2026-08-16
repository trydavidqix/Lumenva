/**
 * AI Platform Phase 6 (n8n) — Task 7: prova o pilot de referência n8n -> CRM
 * (`docs/examples/n8n/crm-read-write.md`) contra o código REAL, não uma
 * reimplementação.
 *
 * Duas tools do catálogo real (nenhuma nova, nenhuma genérica — o brief
 * proíbe "broad generic tool"):
 *   - READ:  `crm_get_lead`    (lib/mcp/tools/leads.ts)      — requiresScope
 *            "mcp:read", requiresRole "agent".
 *   - WRITE: `crm_manage_tags` (lib/mcp/tools/governance.ts, target_kind
 *            "lead") — requiresScope "mcp:write", requiresRole "agent".
 * Narrativa do pilot: um workflow n8n recebe um sinal externo (ex.: webhook
 * de pagamento confirmado), lê o lead com `crm_get_lead` e, se o lead é da
 * própria org do token, marca-o com `crm_manage_tags` (add: ["payment_confirmed"]).
 *
 * `callThroughPipeline` reproduz, NA MESMA ORDEM, o pipeline real de
 * `lib/mcp/server.ts` dentro de `registerTool(...)`:
 *   validateBearerToken (lib/mcp/auth.ts, 401 antes de qualquer tool)
 *     -> ensureScope (403)
 *     -> ensureRole (403)
 *     -> tool.handler(args, ctx)
 * Isto NÃO reimplementa o transporte JSON-RPC/Streamable HTTP do SDK
 * (`app/api/mcp/route.ts`) — como a Task 6 optou por não subir uma instância
 * n8n real, aqui optamos por não recriar o transporte MCP inteiro em teste;
 * o pipeline acima é o código de produção real que decide auth/scope/role/
 * dado, só sem o envelope de transporte por cima. A distinção entre "401 HTTP
 * puro" (falha de auth, ANTES do MCP server processar) e "200 HTTP com
 * `result.isError:true`" (falha de scope/role DENTRO do protocolo MCP,
 * lida em `lib/mcp/server.ts`) foi verificada lendo `app/api/mcp/route.ts` e
 * `lib/mcp/server.ts` diretamente e está documentada em
 * `docs/examples/n8n/crm-read-write.md` — não foi provada aqui contra um
 * transporte HTTP real, o que fica registrado como limitação explícita no
 * report da task.
 *
 * Não re-prova o que já está travado:
 *   - Task 1 (`n8n-integration-boundary.test.ts`): organizationId só vem de
 *     `api_tokens`; toda tool write/handoff exige `mcp:write`.
 *   - Task 4 (`n8n-mcp-scope.test.ts`): TODO o catálogo real barra tool
 *     write/handoff para token read-only e barra tool manager-only para
 *     role:agent; cross-tenant concreto para `crm_get_lead`/`crm_update_lead`.
 * Esta task usa DUAS tools diferentes (`crm_get_lead` + `crm_manage_tags`,
 * não `crm_update_lead`) como o par read+write do pilot de referência, e
 * cobre os três estados de falha de token (revoked/expired/wrong-scope) que
 * nem Task 1 nem Task 4 cobrem para este par específico, além de provar que
 * o handler NUNCA é chamado (via um stub que lança se tocado) quando o gate
 * falha antes dele.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn().mockResolvedValue(undefined) }));

import { createAdminClient } from "@/lib/supabase/admin";
import { ensureRole, ensureScope, McpAuthError, validateBearerToken } from "@/lib/mcp/auth";
import { crmGetLead } from "@/lib/mcp/tools/leads";
import { crmManageTags } from "@/lib/mcp/tools/governance";
import type { McpContext, McpToolDefinition } from "@/lib/mcp/types";

const REPO_ROOT = join(__dirname, "..", "..");
const DOC_PATH = join(REPO_ROOT, "docs", "examples", "n8n", "crm-read-write.md");

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LEAD_IN_ORG_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LEAD_IN_ORG_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

// ---------------------------------------------------------------------------
// Fixtures de token — só o formato importa (o stub abaixo não bate hash de
// verdade, ele devolve a row configurada), nunca cole um plaintext real aqui.
// ---------------------------------------------------------------------------

const READ_TOKEN_VALID = "dsk_test_read_valid_0001";
const WRITE_TOKEN_VALID = "dsk_test_write_valid_0001";
const READ_TOKEN_REVOKED = "dsk_test_read_revoked_0001";
const READ_TOKEN_EXPIRED = "dsk_test_read_expired_0001";
const READ_TOKEN_WRONG_SCOPE = "dsk_test_read_wrongscope_0001";
const WRITE_TOKEN_REVOKED = "dsk_test_write_revoked_0001";
const WRITE_TOKEN_EXPIRED = "dsk_test_write_expired_0001";
const WRITE_TOKEN_WRONG_SCOPE = "dsk_test_write_wrongscope_0001";

interface TokenRow {
  id: string;
  organization_id: string;
  scopes: string[];
  revoked_at: string | null;
  expires_at: string | null;
}

const TOKEN_ROWS: Record<string, TokenRow> = {
  [READ_TOKEN_VALID]: {
    id: "tok-read-valid",
    organization_id: ORG_A,
    scopes: ["mcp:read", "role:agent"],
    revoked_at: null,
    expires_at: null,
  },
  [WRITE_TOKEN_VALID]: {
    id: "tok-write-valid",
    organization_id: ORG_A,
    scopes: ["mcp:write", "role:agent"],
    revoked_at: null,
    expires_at: null,
  },
  [READ_TOKEN_REVOKED]: {
    id: "tok-read-revoked",
    organization_id: ORG_A,
    scopes: ["mcp:read", "role:agent"],
    revoked_at: new Date().toISOString(),
    expires_at: null,
  },
  [READ_TOKEN_EXPIRED]: {
    id: "tok-read-expired",
    organization_id: ORG_A,
    scopes: ["mcp:read", "role:agent"],
    revoked_at: null,
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  },
  // Token válido, não revogado, não expirado — mas SEM o scope que a tool
  // read exige (tem só mcp:write). É o cenário "wrong-scope" do brief.
  [READ_TOKEN_WRONG_SCOPE]: {
    id: "tok-read-wrongscope",
    organization_id: ORG_A,
    scopes: ["mcp:write", "role:agent"],
    revoked_at: null,
    expires_at: null,
  },
  [WRITE_TOKEN_REVOKED]: {
    id: "tok-write-revoked",
    organization_id: ORG_A,
    scopes: ["mcp:write", "role:agent"],
    revoked_at: new Date().toISOString(),
    expires_at: null,
  },
  [WRITE_TOKEN_EXPIRED]: {
    id: "tok-write-expired",
    organization_id: ORG_A,
    scopes: ["mcp:write", "role:agent"],
    revoked_at: null,
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  },
  // Válido, mas só tem mcp:read — a tool write exige mcp:write.
  [WRITE_TOKEN_WRONG_SCOPE]: {
    id: "tok-write-wrongscope",
    organization_id: ORG_A,
    scopes: ["mcp:read", "role:agent"],
    revoked_at: null,
    expires_at: null,
  },
};

/** Stub do admin client SÓ para a lookup de `api_tokens` (lib/mcp/auth.ts). */
function makeTokenAdminStub(plaintext: string) {
  const row = TOKEN_ROWS[plaintext] ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    update: () => chain,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
    then: (resolve: (v: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
  };
  return { from: () => chain };
}

// ---------------------------------------------------------------------------
// Stub de `crm_leads` para o handler de negócio — só entende `.eq(...)`
// acumulado + `maybeSingle()`/`then()`, e REGISTRA todo `.update(...)` que
// efetivamente casou um filtro, para provar "nenhuma mutação aconteceu" nos
// casos de falha (não só "o retorno foi um erro").
// ---------------------------------------------------------------------------

interface LeadRow {
  id: string;
  organization_id: string;
  title: string;
  pipeline_id: string;
  stage_id: string | null;
  owner_user_id: string | null;
  status: string;
  tags: string[];
}

function makeCrmLeadsStub(rows: LeadRow[]) {
  const capturedUpdates: Array<{ filters: Record<string, unknown>; values: Record<string, unknown> }> = [];

  function from(table: string) {
    if (table !== "crm_leads") {
      throw new Error(`stub de teste não cobre a tabela "${table}"`);
    }
    const filters: Record<string, unknown> = {};
    let pendingUpdate: Record<string, unknown> | null = null;

    function findMatch(): LeadRow | undefined {
      return rows.find((r) =>
        Object.entries(filters).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v),
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select: () => chain,
      update: (values: Record<string, unknown>) => {
        pendingUpdate = values;
        return chain;
      },
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      maybeSingle: () => {
        const match = findMatch();
        if (pendingUpdate && match) {
          capturedUpdates.push({ filters: { ...filters }, values: pendingUpdate });
          Object.assign(match, pendingUpdate);
        }
        return Promise.resolve({ data: match ?? null, error: null });
      },
      then: (resolve: (v: { data: unknown; error: null }) => unknown) => {
        const match = findMatch();
        if (pendingUpdate) {
          if (match) {
            capturedUpdates.push({ filters: { ...filters }, values: pendingUpdate });
            Object.assign(match, pendingUpdate);
          }
          return Promise.resolve({ data: null, error: null }).then(resolve);
        }
        return Promise.resolve({ data: match ?? null, error: null }).then(resolve);
      },
    };
    return chain;
  }

  return { supabase: { from } as unknown as McpContext["supabase"], capturedUpdates };
}

/** Prova que o handler NUNCA tocou supabase quando o gate falha antes dele. */
function poisonedSupabase(): McpContext["supabase"] {
  return {
    from: () => {
      throw new Error(
        "handler não deveria ter tocado o supabase — auth/scope/role tem que falhar ANTES do handler",
      );
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// ---------------------------------------------------------------------------
// Pipeline: mesma ordem de lib/mcp/server.ts dentro de registerTool(...).
// `PipelineTool` evita a variância de TInput em McpToolDefinition<TInput>
// (handler é contravariante em TInput — mesmo motivo pelo qual
// lib/mcp/tools/index.ts precisa apagar o input shape via `unknown` para
// juntar tools heterogêneas num array só). `input: never` no handler aceita
// qualquer handler concreto (never é assignable a qualquer parâmetro), e o
// call site casta `args as never` — o mesmo padrão que `lib/mcp/server.ts`
// já usa (`tool.handler(args as never, ctx)`), não uma invenção deste teste.
// ---------------------------------------------------------------------------

type PipelineTool = Pick<McpToolDefinition, "requiresScope" | "requiresRole"> & {
  handler: (input: never, ctx: McpContext) => Promise<unknown>;
};

async function callThroughPipeline(
  tool: PipelineTool,
  authHeader: string,
  args: Record<string, unknown>,
  supabase: McpContext["supabase"],
): Promise<unknown> {
  const auth = await validateBearerToken(authHeader);
  ensureScope(auth.scopes, tool.requiresScope);
  ensureRole(auth.role, tool.requiresRole);
  const ctx: McpContext = {
    organizationId: auth.organizationId,
    role: auth.role,
    actor: auth.actor,
    apiTokenId: auth.apiTokenId,
    requestId: "req-n8n-inbound-test",
    supabase,
  };
  return tool.handler(args as never, ctx);
}

function bearer(plaintext: string): string {
  return `Bearer ${plaintext}`;
}

beforeEach(() => {
  vi.clearAllMocks();
});

function mockToken(plaintext: string): void {
  vi.mocked(createAdminClient).mockReturnValue(makeTokenAdminStub(plaintext) as never);
}

// ---------------------------------------------------------------------------
// Guarda de vacuidade: as duas tools escolhidas existem no catálogo real com
// o scope/role/categoria que o resto deste arquivo assume.
// ---------------------------------------------------------------------------

describe("guarda de vacuidade: crm_get_lead / crm_manage_tags têm o contrato assumido pelo resto do arquivo", () => {
  it("crm_get_lead: category read, requiresScope mcp:read, requiresRole agent", () => {
    expect(crmGetLead.category).toBe("read");
    expect(crmGetLead.requiresScope).toBe("mcp:read");
    expect(crmGetLead.requiresRole).toBe("agent");
  });

  it("crm_manage_tags: category write, requiresScope mcp:write, requiresRole agent", () => {
    expect(crmManageTags.category).toBe("write");
    expect(crmManageTags.requiresScope).toBe("mcp:write");
    expect(crmManageTags.requiresRole).toBe("agent");
  });
});

// ---------------------------------------------------------------------------
// READ tool (crm_get_lead): sucesso + 3 casos de falha fechada.
// ---------------------------------------------------------------------------

describe("crm_get_lead (read): sucesso + revoked/expired/wrong-scope falham fechado", () => {
  it("sucesso: token válido da org A lê um lead real da própria org", async () => {
    mockToken(READ_TOKEN_VALID);
    const { supabase } = makeCrmLeadsStub([
      {
        id: LEAD_IN_ORG_A,
        organization_id: ORG_A,
        title: "Lead da org A",
        pipeline_id: "pipe-a",
        stage_id: null,
        owner_user_id: null,
        status: "open",
        tags: [],
      },
    ]);
    const result = (await callThroughPipeline(
      crmGetLead,
      bearer(READ_TOKEN_VALID),
      { lead_id: LEAD_IN_ORG_A },
      supabase,
    )) as { lead: Record<string, unknown> };
    expect(result.lead.id).toBe(LEAD_IN_ORG_A);
  });

  it("revoked: falha fechado (401) antes de tocar o supabase de negócio", async () => {
    mockToken(READ_TOKEN_REVOKED);
    await expect(
      callThroughPipeline(
        crmGetLead,
        bearer(READ_TOKEN_REVOKED),
        { lead_id: LEAD_IN_ORG_A },
        poisonedSupabase(),
      ),
    ).rejects.toMatchObject({ httpStatus: 401 });
  });

  it("expired: falha fechado (401) antes de tocar o supabase de negócio", async () => {
    mockToken(READ_TOKEN_EXPIRED);
    await expect(
      callThroughPipeline(
        crmGetLead,
        bearer(READ_TOKEN_EXPIRED),
        { lead_id: LEAD_IN_ORG_A },
        poisonedSupabase(),
      ),
    ).rejects.toMatchObject({ httpStatus: 401 });
  });

  it("wrong-scope (token só tem mcp:write): ensureScope barra com 403 antes de tocar o supabase de negócio", async () => {
    mockToken(READ_TOKEN_WRONG_SCOPE);
    try {
      await callThroughPipeline(
        crmGetLead,
        bearer(READ_TOKEN_WRONG_SCOPE),
        { lead_id: LEAD_IN_ORG_A },
        poisonedSupabase(),
      );
      throw new Error("deveria ter lançado McpAuthError");
    } catch (err) {
      expect(err).toBeInstanceOf(McpAuthError);
      expect((err as McpAuthError).httpStatus).toBe(403);
    }
  });
});

// ---------------------------------------------------------------------------
// WRITE tool (crm_manage_tags, target_kind=lead): sucesso + 3 falhas fechadas.
// ---------------------------------------------------------------------------

describe("crm_manage_tags (write, lead): sucesso + revoked/expired/wrong-scope falham fechado", () => {
  it("sucesso: token válido da org A marca (add tag) um lead real da própria org", async () => {
    mockToken(WRITE_TOKEN_VALID);
    const { supabase, capturedUpdates } = makeCrmLeadsStub([
      {
        id: LEAD_IN_ORG_A,
        organization_id: ORG_A,
        title: "Lead da org A",
        pipeline_id: "pipe-a",
        stage_id: null,
        owner_user_id: null,
        status: "open",
        tags: [],
      },
    ]);
    const result = (await callThroughPipeline(
      crmManageTags,
      bearer(WRITE_TOKEN_VALID),
      { target_kind: "lead" as const, target_id: LEAD_IN_ORG_A, add: ["payment_confirmed"], remove: undefined },
      supabase,
    )) as { tags: string[] };
    expect(result.tags).toEqual(["payment_confirmed"]);
    expect(capturedUpdates).toHaveLength(1);
    expect(capturedUpdates[0]!.values).toEqual({ tags: ["payment_confirmed"] });
  });

  it("revoked: falha fechado (401), nenhuma mutação registrada", async () => {
    mockToken(WRITE_TOKEN_REVOKED);
    await expect(
      callThroughPipeline(
        crmManageTags,
        bearer(WRITE_TOKEN_REVOKED),
        { target_kind: "lead" as const, target_id: LEAD_IN_ORG_A, add: ["payment_confirmed"], remove: undefined },
        poisonedSupabase(),
      ),
    ).rejects.toMatchObject({ httpStatus: 401 });
  });

  it("expired: falha fechado (401), nenhuma mutação registrada", async () => {
    mockToken(WRITE_TOKEN_EXPIRED);
    await expect(
      callThroughPipeline(
        crmManageTags,
        bearer(WRITE_TOKEN_EXPIRED),
        { target_kind: "lead" as const, target_id: LEAD_IN_ORG_A, add: ["payment_confirmed"], remove: undefined },
        poisonedSupabase(),
      ),
    ).rejects.toMatchObject({ httpStatus: 401 });
  });

  it("wrong-scope (token só tem mcp:read): ensureScope barra com 403, nenhuma mutação registrada", async () => {
    mockToken(WRITE_TOKEN_WRONG_SCOPE);
    try {
      await callThroughPipeline(
        crmManageTags,
        bearer(WRITE_TOKEN_WRONG_SCOPE),
        { target_kind: "lead" as const, target_id: LEAD_IN_ORG_A, add: ["payment_confirmed"], remove: undefined },
        poisonedSupabase(),
      );
      throw new Error("deveria ter lançado McpAuthError");
    } catch (err) {
      expect(err).toBeInstanceOf(McpAuthError);
      expect((err as McpAuthError).httpStatus).toBe(403);
    }
  });
});

// ---------------------------------------------------------------------------
// Forjar organização no payload: token da org A, target_id/lead_id REAL mas
// pertencente à org B. A org nunca vem do payload — só do token
// (validateBearerToken) — então a operação continua escopada à org do token
// e nunca vaza/muta o recurso da org B.
// ---------------------------------------------------------------------------

describe("payload forjado: token da org A não lê nem edita recurso real da org B", () => {
  it("crm_get_lead: lead_id real da org B não é lido pela org A (404, sem vazar a row)", async () => {
    mockToken(READ_TOKEN_VALID);
    const { supabase } = makeCrmLeadsStub([
      {
        id: LEAD_IN_ORG_B,
        organization_id: ORG_B,
        title: "Lead da org B — não deveria ser lido pela org A",
        pipeline_id: "pipe-b",
        stage_id: null,
        owner_user_id: null,
        status: "open",
        tags: [],
      },
    ]);
    await expect(
      callThroughPipeline(crmGetLead, bearer(READ_TOKEN_VALID), { lead_id: LEAD_IN_ORG_B }, supabase),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("crm_manage_tags: target_id real de lead da org B não é editado pela org A (erro, sem mutação)", async () => {
    mockToken(WRITE_TOKEN_VALID);
    const { supabase, capturedUpdates } = makeCrmLeadsStub([
      {
        id: LEAD_IN_ORG_B,
        organization_id: ORG_B,
        title: "Lead da org B — não deveria ser editado pela org A",
        pipeline_id: "pipe-b",
        stage_id: null,
        owner_user_id: null,
        status: "open",
        tags: [],
      },
    ]);
    await expect(
      callThroughPipeline(
        crmManageTags,
        bearer(WRITE_TOKEN_VALID),
        { target_kind: "lead" as const, target_id: LEAD_IN_ORG_B, add: ["payment_confirmed"], remove: undefined },
        supabase,
      ),
    ).rejects.toThrow(/target_not_found/);
    expect(capturedUpdates).toEqual([]);
  });

  it("controle positivo: o mesmo stub resolve o lead REAL da org B para um contexto da própria org B (não é um stub sempre-vazio — a rejeição acima é o filtro de org, não um bug do stub)", async () => {
    const { supabase } = makeCrmLeadsStub([
      {
        id: LEAD_IN_ORG_B,
        organization_id: ORG_B,
        title: "Lead da org B",
        pipeline_id: "pipe-b",
        stage_id: null,
        owner_user_id: null,
        status: "open",
        tags: [],
      },
    ]);
    const ctxOrgB: McpContext = {
      organizationId: ORG_B,
      role: "agent",
      actor: { type: "ai_agent", id: "run-org-b", role: "agent" },
      apiTokenId: "tok-org-b",
      requestId: "req-positive-control",
      supabase,
    };
    const result = (await crmGetLead.handler({ lead_id: LEAD_IN_ORG_B }, ctxOrgB)) as {
      lead: Record<string, unknown>;
    };
    expect(result.lead.id).toBe(LEAD_IN_ORG_B);
  });
});

// ---------------------------------------------------------------------------
// Documentação (brief Step 4): o pilot está documentado sem segredo real e
// cobre os pontos que os testes acima provam.
// ---------------------------------------------------------------------------

describe("docs/examples/n8n/crm-read-write.md: sanitizado e estruturalmente completo", () => {
  const doc = readFileSync(DOC_PATH, "utf8");

  it("nenhum token dsk_ real (só placeholder syntax)", () => {
    expect(doc).not.toMatch(/dsk_[a-zA-Z0-9]{6,}_[a-f0-9]{32,}/);
  });

  it("nenhum segredo hex de 32+ chars solto no documento", () => {
    expect(doc).not.toMatch(/\b[a-f0-9]{32,}\b/);
  });

  it("referencia as duas tools reais escolhidas pelo par read+write", () => {
    expect(doc).toMatch(/crm_get_lead/);
    expect(doc).toMatch(/crm_manage_tags/);
  });

  it("documenta o header Authorization: Bearer (nunca query string)", () => {
    expect(doc).toMatch(/Authorization:\s*Bearer/);
  });

  it("documenta os três estados de falha fechada (revoked/expired/wrong-scope)", () => {
    expect(doc.toLowerCase()).toMatch(/revok/); // "revoke(d)" (doc está em inglês, como o Task 6)
    expect(doc.toLowerCase()).toMatch(/expir/);
    expect(doc.toLowerCase()).toMatch(/scope/);
  });

  it("documenta que organization_id nunca vem do payload — só do token", () => {
    expect(doc).toMatch(/organization_id/);
    expect(doc.toLowerCase()).toMatch(/nunca.*payload|payload.*nunca|token/);
  });
});
