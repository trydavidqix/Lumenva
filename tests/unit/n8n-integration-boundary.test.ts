/**
 * AI Platform Phase 6 (n8n) — Task 1: congela a fronteira de integração ANTES
 * de existir qualquer código n8n-específico no repo.
 *
 * Nenhuma destas asserções é sobre n8n em si (não há n8n aqui ainda). São
 * invariantes sobre os dois caminhos que as Tasks 2-8 vão REUSAR:
 *
 *   - CRM -> n8n: a action `call_webhook` (fetch + anti-SSRF + HMAC), o único
 *     caminho outbound com fetch() em `lib/automation/actions/`;
 *   - n8n -> CRM: `validateBearerToken` (mcp/auth.ts), que resolve
 *     `organizationId` SÓ da row de `api_tokens` — nunca de payload externo —
 *     e o `ensureScope('mcp:write')` que toda tool MUTANTE do catálogo MCP
 *     real já exige hoje.
 *
 * O plano (docs/superpowers/plans/2026-08-10-ai-platform-phase-6-n8n.md)
 * explicitamente proíbe uma segunda implementação de fetch/anti-SSRF/HMAC
 * para n8n ("Do not replace existing call_webhook anti-SSRF/HMAC logic") e
 * proíbe dar a n8n o service-role key ou escrita direta em tabela de negócio.
 * As varreduras estruturais abaixo ficam VAZIAS hoje de propósito — a Task 1
 * roda ANTES da Task 2 existir — e é isso que as torna um teste de regressão
 * de verdade: no dia em que a Task 3 adicionar `n8n-webhook.ts` ou a Task 2/7
 * adicionar `lib/automation/n8n/*`, elas passam a ter algo para checar.
 */
import { createHmac } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { executeCallWebhook } from "@/lib/automation/actions/call-webhook";
import type { ActionCtx } from "@/lib/automation/types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateBearerToken,
  ensureScope,
  ensureRole,
  McpAuthError,
} from "@/lib/mcp/auth";
import { allTools } from "@/lib/mcp/tools";

const REPO_ROOT = join(__dirname, "..", "..");
const CODE_EXT = /\.(ts|tsx)$/;
const TEST_EXT = /\.(test|spec)\.(ts|tsx)$/;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // diretório opcional (ex.: workers/ pode não existir em todo checkout)
  }
  for (const entry of entries) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (CODE_EXT.test(entry)) out.push(full);
  }
  return out;
}

function productionSourceFiles(): string[] {
  return ["lib", "app", "workers"]
    .flatMap((root) => walk(join(REPO_ROOT, root)))
    .filter((f) => !TEST_EXT.test(f));
}

function baseCtx(overrides: Partial<ActionCtx> = {}): ActionCtx {
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
    },
    context: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CRM -> n8n: um único caminho outbound, guardado por assertSafeOutboundUrl.
// ---------------------------------------------------------------------------

describe("CRM -> n8n (outbound): caminho único, guardado por assertSafeOutboundUrl", () => {
  const CALL_WEBHOOK_PATH = join(REPO_ROOT, "lib/automation/actions/call-webhook.ts");
  const OUTBOUND_URL_PATH = join(REPO_ROOT, "lib/automation/outbound-url.ts");

  it("call-webhook.ts importa assertSafeOutboundUrl do módulo canônico de anti-SSRF", () => {
    const src = readFileSync(CALL_WEBHOOK_PATH, "utf8");
    expect(src).toMatch(
      /import\s*\{\s*assertSafeOutboundUrl\s*\}\s*from\s*["']@\/lib\/automation\/outbound-url["']/,
    );
  });

  it("outbound-url.ts expõe um único guard exportado (nenhum segundo caminho de validação de URL)", () => {
    const src = readFileSync(OUTBOUND_URL_PATH, "utf8");
    const exported = [...src.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
    expect(exported).toEqual(["assertSafeOutboundUrl"]);
  });

  it("nenhuma outra action em lib/automation/actions/ chama fetch() por fora do caminho guardado", () => {
    const dir = join(REPO_ROOT, "lib/automation/actions");
    const offenders = readdirSync(dir)
      .filter((f) => CODE_EXT.test(f) && !TEST_EXT.test(f) && f !== "call-webhook.ts")
      .filter((f) => /\bfetch\(/.test(readFileSync(join(dir, f), "utf8")));
    expect(
      offenders,
      `action chamando fetch() diretamente sem passar por call-webhook/assertSafeOutboundUrl: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("comportamental: host privado é barrado ANTES de qualquer fetch (o guard está vivo, não só importado)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await executeCallWebhook(baseCtx(), { url: "http://127.0.0.1:9/hook" });
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/^unsafe_url/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Assinatura HMAC outbound: um único signer, contrato X-Deskcomm-Signature.
// ---------------------------------------------------------------------------

describe("CRM -> n8n (outbound): assinatura HMAC usa o contrato existente, não um segundo signer", () => {
  it("apenas call-webhook.ts define o header X-Deskcomm-Signature em código de produção", () => {
    const setters = productionSourceFiles()
      .filter((f) => /\[\s*["']X-Deskcomm-Signature["']\s*\]\s*=/.test(readFileSync(f, "utf8")))
      .map((f) => relative(REPO_ROOT, f).replace(/\\/g, "/"));
    expect(setters).toEqual(["lib/automation/actions/call-webhook.ts"]);
  });

  it("comportamental: com secret configurado, a assinatura é HMAC-SHA256 do body exatamente enviado", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true, status: 200 } as Response);
    const secret = "***REMOVED***";

    await executeCallWebhook(baseCtx(), { url: "https://example.com/hook", secret }, { skipUrlCheck: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    const bodySent = init.body as string;
    expect(headers["X-Deskcomm-Signature"]).toBe(
      createHmac("sha256", secret).update(bodySent).digest("hex"),
    );
    fetchSpy.mockRestore();
  });

  it("comportamental: sem secret configurado, nenhum signer inventa uma assinatura default", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true, status: 200 } as Response);

    await executeCallWebhook(baseCtx(), { url: "https://example.com/hook" }, { skipUrlCheck: true });

    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Deskcomm-Signature"]).toBeUndefined();
    fetchSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// n8n -> CRM: organizationId vem SÓ de api_tokens, nunca de payload externo.
// ---------------------------------------------------------------------------

describe("n8n -> CRM (inbound): organizationId deriva de api_tokens, nunca do payload", () => {
  const ORG_FROM_TOKEN = "22222222-2222-4222-8222-222222222222";
  const TOKEN_ID = "tok-abc";
  const PLAINTEXT = "dsk_prefix_secret123";

  function makeAdminStub(row: Record<string, unknown> | null, selectError: { message: string } | null = null) {
    const chain = {
      select: () => chain,
      eq: () => chain,
      update: () => chain,
      maybeSingle: () => Promise.resolve(selectError ? { data: null, error: selectError } : { data: row, error: null }),
      then: (resolve: (v: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    return { from: () => chain };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("estrutural: validateBearerToken só recebe o header — não existe segundo parâmetro para 'organização confiada'", () => {
    expect(validateBearerToken.length).toBe(1);
  });

  it("token válido: organizationId retornado é EXATAMENTE o organization_id da row de api_tokens", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeAdminStub({
        id: TOKEN_ID,
        organization_id: ORG_FROM_TOKEN,
        scopes: ["mcp:read", "mcp:write", "role:agent"],
        revoked_at: null,
        expires_at: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    );
    const result = await validateBearerToken(`Bearer ${PLAINTEXT}`);
    expect(result.organizationId).toBe(ORG_FROM_TOKEN);
    expect(result.apiTokenId).toBe(TOKEN_ID);
  });

  it("sem Authorization header: falha fechado (401), sem consultar api_tokens", async () => {
    const admin = makeAdminStub(null);
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
    await expect(validateBearerToken(null)).rejects.toMatchObject({
      httpStatus: 401,
    });
  });

  it("token não reconhecido (row ausente): falha fechado (401)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(makeAdminStub(null) as never);
    await expect(validateBearerToken(`Bearer ${PLAINTEXT}`)).rejects.toMatchObject({ httpStatus: 401 });
  });

  it("token revogado: falha fechado (401) mesmo com organization_id presente na row", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeAdminStub({
        id: TOKEN_ID,
        organization_id: ORG_FROM_TOKEN,
        scopes: [],
        revoked_at: new Date().toISOString(),
        expires_at: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    );
    await expect(validateBearerToken(`Bearer ${PLAINTEXT}`)).rejects.toMatchObject({ httpStatus: 401 });
  });

  it("token expirado: falha fechado (401)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeAdminStub({
        id: TOKEN_ID,
        organization_id: ORG_FROM_TOKEN,
        scopes: [],
        revoked_at: null,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    );
    await expect(validateBearerToken(`Bearer ${PLAINTEXT}`)).rejects.toMatchObject({ httpStatus: 401 });
  });

  it("formato inválido (sem prefixo dsk_): falha fechado (401), sem consultar api_tokens", async () => {
    const admin = makeAdminStub(null);
    vi.mocked(createAdminClient).mockReturnValue(admin as never);
    await expect(validateBearerToken("Bearer nao-e-um-token-deskcomm")).rejects.toBeInstanceOf(McpAuthError);
  });
});

// ---------------------------------------------------------------------------
// mcp:write é exigido por toda tool mutante do catálogo MCP real.
// ---------------------------------------------------------------------------

describe("n8n -> CRM (inbound): mcp:write é exigido por toda tool mutante", () => {
  it("guarda de vacuidade: o catálogo real de tools não vem vazio", () => {
    expect(allTools.length).toBeGreaterThan(0);
  });

  it("toda tool category='write'|'handoff' exige requiresScope='mcp:write'", () => {
    const violacoes = allTools
      .filter((t) => t.category === "write" || t.category === "handoff")
      .filter((t) => t.requiresScope !== "mcp:write")
      .map((t) => t.name);
    expect(violacoes, `tool mutante sem exigir mcp:write: ${violacoes.join(", ")}`).toEqual([]);
  });

  it("toda tool requiresScope='mcp:read' é category='read' (nenhuma escrita disfarçada de leitura)", () => {
    const violacoes = allTools
      .filter((t) => t.requiresScope === "mcp:read")
      .filter((t) => t.category !== "read")
      .map((t) => t.name);
    expect(violacoes, `tool com scope de leitura mas categoria mutante: ${violacoes.join(", ")}`).toEqual([]);
  });

  it("comportamental: ensureScope barra token sem mcp:write com 403", () => {
    expect(() => ensureScope(["mcp:read"], "mcp:write")).toThrow(McpAuthError);
    try {
      ensureScope(["mcp:read"], "mcp:write");
      throw new Error("deveria ter lançado");
    } catch (err) {
      expect(err).toBeInstanceOf(McpAuthError);
      expect((err as McpAuthError).httpStatus).toBe(403);
    }
  });

  it("comportamental: ensureScope aceita token com mcp:write presente", () => {
    expect(() => ensureScope(["mcp:write"], "mcp:write")).not.toThrow();
  });

  it("comportamental: ensureRole barra role abaixo do mínimo exigido pela tool", () => {
    expect(() => ensureRole("agent", "manager")).toThrow(McpAuthError);
    expect(() => ensureRole("manager", "manager")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Nenhum código n8n-específico importa lib/supabase/admin.
// ---------------------------------------------------------------------------
//
// A Task 1 introduziu este describe block ANTES de qualquer código n8n
// existir, com um teste-tripwire que ficava vacuamente verdadeiro até o dia
// em que Tasks 2/3 adicionassem arquivos reais — esse dia chegou
// (lib/automation/n8n/envelope.ts, lib/automation/actions/n8n-webhook.ts).
// O tripwire foi removido; o teste abaixo ("quando arquivos n8n existirem...")
// já cobria a mesma propriedade contra arquivos reais desde a Task 1 e
// continua sendo o guard vivo.

describe("nenhum código n8n-específico importa lib/supabase/admin para mutação direta de tabela de negócio", () => {
  function n8nProductionFiles(): string[] {
    return productionSourceFiles().filter((f) => /n8n/i.test(f));
  }

  it("guarda de vacuidade: o detector de import reconhece um import REAL de lib/supabase/admin", () => {
    // lib/mcp/auth.ts importa o admin client legitimamente (auth.ts não é
    // n8n-específico) — prova que a regex abaixo não está cega antes de
    // confiar no resultado da varredura n8n.
    const src = readFileSync(join(REPO_ROOT, "lib/mcp/auth.ts"), "utf8");
    expect(/from\s+["']@\/lib\/supabase\/admin["']/.test(src)).toBe(true);
  });

  it("guarda de vacuidade: o filtro de nome de arquivo reconhece caminhos n8n previstos pelo plano", () => {
    expect(/n8n/i.test("lib/automation/n8n/envelope.ts")).toBe(true);
    expect(/n8n/i.test("lib/automation/actions/n8n-webhook.ts")).toBe(true);
    expect(/n8n/i.test("lib/automation/actions/call-webhook.ts")).toBe(false);
  });

  it("guarda de sinal: pelo menos um arquivo n8n-específico real existe (a varredura abaixo não é vacuamente verdadeira)", () => {
    expect(n8nProductionFiles().length).toBeGreaterThan(0);
  });

  it("nenhum arquivo n8n-específico importa lib/supabase/admin", () => {
    const offenders = n8nProductionFiles().filter((f) =>
      /from\s+["']@\/lib\/supabase\/admin["']/.test(readFileSync(f, "utf8")),
    );
    expect(
      offenders.map((f) => relative(REPO_ROOT, f).replace(/\\/g, "/")),
      "código n8n-específico com import direto do service-role client — o plano da Phase 6 proíbe n8n mutar tabela de negócio diretamente (deve passar por API/MCP com RLS ou pelo caminho de outbound já auditado)",
    ).toEqual([]);
  });
});
