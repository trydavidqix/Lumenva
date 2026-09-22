import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { loadAuthUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { resolvePlatformAdmin, type PlatformAdminContext } from "@/lib/auth/requirePlatformAdmin";
import { requirePlatformAdminApi } from "@/lib/auth/require-platform-admin-api";
import { fail } from "@/lib/api/wrappers";

vi.mock("@/lib/auth/server", () => ({ loadAuthUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/auth/requirePlatformAdmin", () => ({ resolvePlatformAdmin: vi.fn() }));
vi.mock("@/lib/auth/require-platform-admin-api", () => ({ requirePlatformAdminApi: vi.fn() }));

const OWNER = { id: "11111111-1111-4111-8111-111111111111", email: "dono@x.com", is_platform_admin: true };
const MEMBRO = { ...OWNER, id: "22222222-2222-4222-8222-222222222222", is_platform_admin: false };
const OWNER_CONTEXT: PlatformAdminContext = {
  user: {
    id: OWNER.id,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-09-22T00:00:00.000Z",
  },
  platformAdmin: { user_id: OWNER.id, scope: "*", mfa_required: true },
};

let versionRow: Record<string, unknown>;
let runRow: Record<string, unknown> | null;
let inserted: Record<string, unknown> | null;
let runUpdatePatch: Record<string, unknown> | null;
let versionUpdatePatch: Record<string, unknown> | null;
let insertError: { code: string; message: string } | null;
let versionSelectError: { message: string } | null;
let runSelectError: { message: string } | null;

beforeEach(() => {
  vi.clearAllMocks();
  inserted = null;
  runRow = null;
  runUpdatePatch = null;
  versionUpdatePatch = null;
  insertError = null;
  versionSelectError = null;
  runSelectError = null;
  versionRow = {
    id: 1,
    current_version: "1.0.0",
    latest_version: "1.1.0",
    off_release: false,
    changelog_raw: "## [1.1.0] — 2026-08-02\n\n**⚠️ Requer atenção**\n\nreconecte o número.\n\n### Adicionado\n\n- botão.\n",
    agent_last_seen_at: new Date().toISOString(),
    compare_failed: false,
    update_requested_at: null,
  };

  vi.mocked(resolvePlatformAdmin).mockResolvedValue({ ok: true, context: OWNER_CONTEXT });
  vi.mocked(requirePlatformAdminApi).mockResolvedValue({ ok: true, context: OWNER_CONTEXT });

  vi.mocked(createAdminClient).mockReturnValue({
    from: (table: string) => {
      const maybeSingle = async () => ({
        data: table === "system_version" ? versionRow : runRow,
        error: table === "system_version" ? versionSelectError : runSelectError,
      });
      return {
        select: () => ({
          eq: () => ({
            maybeSingle,
            order: () => ({ limit: () => ({ maybeSingle }) }),
          }),
          order: () => ({ limit: () => ({ maybeSingle }) }),
        }),
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              if (insertError) return { data: null, error: insertError };
              inserted = row;
              return { data: { id: "44444444-4444-4444-8444-444444444444", ...row }, error: null };
            },
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          const chain: { eq: () => typeof chain; then: Promise<{ error: null }>["then"] } = {
            eq: () => chain,
            then: (onFulfilled, onRejected) => {
              if (table === "system_update_runs") runUpdatePatch = patch;
              if (table === "system_version") versionUpdatePatch = patch;
              return Promise.resolve({ error: null }).then(onFulfilled, onRejected);
            },
          };
          return chain;
        },
      };
    },
  } as never);
});

function get() {
  return new NextRequest("http://localhost/api/v1/system/version");
}
function post() {
  return new NextRequest("http://localhost/api/v1/system/update", { method: "POST" });
}

describe("GET /api/v1/system/version", () => {
  it("exige sessão", async () => {
    vi.mocked(loadAuthUser).mockResolvedValue(null);
    const { GET } = await import("./route");
    const res = await GET(get());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("unauthenticated");
  });

  it("quando a leitura de system_version falha, devolve 500", async () => {
    vi.mocked(loadAuthUser).mockResolvedValue(OWNER as never);
    versionSelectError = { message: "conexão caiu" };
    const { GET } = await import("./route");
    expect((await GET(get())).status).toBe(500);
  });

  it("quando a leitura do run mais recente falha, devolve 500", async () => {
    vi.mocked(loadAuthUser).mockResolvedValue(OWNER as never);
    runSelectError = { message: "conexão caiu" };
    const { GET } = await import("./route");
    expect((await GET(get())).status).toBe(500);
  });

  it("entrega só a versão para quem não é dono do servidor", async () => {
    vi.mocked(loadAuthUser).mockResolvedValue(MEMBRO as never);
    vi.mocked(resolvePlatformAdmin).mockResolvedValue({ ok: false, reason: "forbidden" });
    const { GET } = await import("./route");
    const body = await (await GET(get())).json();
    expect(body.data.current_version).toBe("1.0.0");
    expect(body.data.is_owner).toBe(false);
    expect(body.data.update_available).toBeUndefined();
    expect(body.data.notes).toBeUndefined();
  });

  it("entrega o estado completo e a seção do CHANGELOG para o dono", async () => {
    vi.mocked(loadAuthUser).mockResolvedValue(OWNER as never);
    const { GET } = await import("./route");
    const body = await (await GET(get())).json();
    expect(body.data.update_available).toBe(true);
    expect(body.data.notes.body).toContain("botão");
    expect(body.data.notes.requires_attention).toContain("reconecte o número");
  });

  it("entrega compare_failed para a tela poder dizer 'não sei' em vez de 'está em dia'", async () => {
    versionRow.latest_version = "";
    versionRow.compare_failed = true;
    vi.mocked(loadAuthUser).mockResolvedValue(OWNER as never);
    const { GET } = await import("./route");
    const body = await (await GET(get())).json();
    expect(body.data.compare_failed).toBe(true);
    expect(body.data.update_available).toBe(false);
  });

  it("entrega has_known_release=false para distinguir 'nunca houve release' de 'à frente da publicada'", async () => {
    versionRow.latest_version = "";
    versionRow.off_release = true;
    versionRow.has_known_release = false;
    vi.mocked(loadAuthUser).mockResolvedValue(OWNER as never);
    const { GET } = await import("./route");
    const body = await (await GET(get())).json();
    expect(body.data.has_known_release).toBe(false);
  });

  it("has_known_release default true quando a coluna nunca foi tocada por um heartbeat", async () => {
    delete versionRow.has_known_release;
    vi.mocked(loadAuthUser).mockResolvedValue(OWNER as never);
    const { GET } = await import("./route");
    const body = await (await GET(get())).json();
    expect(body.data.has_known_release).toBe(true);
  });

  it("marca o agente como offline quando o heartbeat é velho", async () => {
    versionRow.agent_last_seen_at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    vi.mocked(loadAuthUser).mockResolvedValue(OWNER as never);
    const { GET } = await import("./route");
    const body = await (await GET(get())).json();
    expect(body.data.agent_online).toBe(false);
  });

  it("entrega as versões do run e o log da tentativa (o diagnóstico da falha)", async () => {
    versionRow.current_version = "1.1.0";
    runRow = {
      id: "55555555-5555-4555-8555-555555555555",
      status: "failed_rolled_back",
      last_step: "banco",
      dispatched_at: new Date().toISOString(),
      from_version: "1.0.0",
      to_version: "1.1.0",
      log_tail: "✖ o app não respondeu ok",
    };
    vi.mocked(loadAuthUser).mockResolvedValue(OWNER as never);
    const { GET } = await import("./route");
    const body = await (await GET(get())).json();
    expect(body.data.run.from_version).toBe("1.0.0");
    expect(body.data.run.to_version).toBe("1.1.0");
    expect(body.data.run.log_tail).toContain("não respondeu ok");
    expect(body.data.current_version).toBe("1.0.0");
    expect(body.data.update_available).toBe(true);
  });

  it("depois de um rollback, quem não é dono também vê a versão que está no ar", async () => {
    versionRow.current_version = "1.1.0";
    runRow = {
      id: "55555555-5555-4555-8555-555555555555",
      status: "failed_rolled_back",
      last_step: "banco",
      dispatched_at: new Date().toISOString(),
      from_version: "1.0.0",
      to_version: "1.1.0",
      log_tail: "",
    };
    vi.mocked(loadAuthUser).mockResolvedValue(MEMBRO as never);
    vi.mocked(resolvePlatformAdmin).mockResolvedValue({ ok: false, reason: "forbidden" });
    const { GET } = await import("./route");
    const body = await (await GET(get())).json();
    expect(body.data.current_version).toBe("1.0.0");
  });

  it("deriva unknown num run parado há muito tempo", async () => {
    runRow = {
      id: "55555555-5555-4555-8555-555555555555",
      status: "dispatched",
      last_step: "banco",
      dispatched_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    };
    vi.mocked(loadAuthUser).mockResolvedValue(OWNER as never);
    const { GET } = await import("./route");
    const body = await (await GET(get())).json();
    expect(body.data.run.status).toBe("unknown");
  });
});

describe("POST /api/v1/system/update", () => {
  it("exige sessão", async () => {
    vi.mocked(requirePlatformAdminApi).mockResolvedValue({ ok: false, response: fail("unauthenticated", "Faça login", 401) });
    const { POST } = await import("../update/route");
    const res = await POST(post());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("unauthenticated");
  });

  it("nega para quem não é dono do servidor", async () => {
    vi.mocked(requirePlatformAdminApi).mockResolvedValue({ ok: false, response: fail("forbidden", "Proibido", 403) });
    const { POST } = await import("../update/route");
    expect((await POST(post())).status).toBe(403);
    expect(inserted).toBeNull();
  });

  it("quando a leitura de system_version falha, devolve 500 e não 409", async () => {
    versionSelectError = { message: "conexão caiu" };
    const { POST } = await import("../update/route");
    const res = await POST(post());
    expect(res.status).toBe(500);
    expect(inserted).toBeNull();
  });

  it("cria o run como ÚNICA ordem — sem um segundo estado em system_version", async () => {
    const { POST } = await import("../update/route");
    expect((await POST(post())).status).toBe(200);
    expect(inserted).toMatchObject({
      from_version: "1.0.0",
      to_version: "1.1.0",
      status: "dispatched",
      requested_by: OWNER.id,
    });
    expect(versionUpdatePatch).toBeNull();
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "system.update_requested" }));
  });

  it("recusa um segundo pedido enquanto há run em andamento", async () => {
    runRow = {
      id: "55555555-5555-4555-8555-555555555555",
      status: "dispatched",
      dispatched_at: new Date().toISOString(),
    };
    const { POST } = await import("../update/route");
    expect((await POST(post())).status).toBe(409);
    expect(runUpdatePatch).toBeNull();
  });

  it("expira um run 'dispatched' abandonado (agente morto há mais de 15min) e aceita o pedido novo", async () => {
    runRow = {
      id: "55555555-5555-4555-8555-555555555555",
      status: "dispatched",
      dispatched_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    };
    const { POST } = await import("../update/route");
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(runUpdatePatch).toMatchObject({ status: "failed" });
    expect(inserted).toMatchObject({ from_version: "1.0.0", to_version: "1.1.0", status: "dispatched" });
  });

  it("recusa quando já está na última versão", async () => {
    versionRow.latest_version = "1.0.0";
    const { POST } = await import("../update/route");
    expect((await POST(post())).status).toBe(409);
  });

  it("converte a violação do índice único (corrida de dois cliques) em 409, não 500", async () => {
    insertError = { code: "23505", message: 'duplicate key value violates unique constraint "uniq_system_update_runs_dispatched"' };
    const { POST } = await import("../update/route");
    const res = await POST(post());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("state_conflict");
    expect(body.error.message).toBe("Já existe uma atualização em andamento.");
  });
});
