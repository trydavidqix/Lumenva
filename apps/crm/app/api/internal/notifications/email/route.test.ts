// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.hoisted(() => ({ valid: true }));
const rateMock = vi.hoisted(() => ({ allowed: true }));
const envMock = vi.hoisted(() => ({
  EMAIL_RELAY_OWNER_WHATSAPP_E164: "+351912345678",
  EMAIL_RELAY_ORGANIZATION_ID: "22222222-2222-4222-8222-222222222222",
  EMAIL_RELAY_DRY_RUN: true,
}));

vi.mock("@/lib/auth/cron-secret", () => ({
  bearerFromHeader: (h: string | null) => h?.replace(/^Bearer\s+/i, "") ?? "",
  cronSecretMatches: () => authMock.valid,
}));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: rateMock.allowed, count: 1, limit: 120, window_sec: 60 })),
}));
vi.mock("@/lib/env", () => ({ env: envMock }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/app/api/v1/messages/_handler", () => ({ sendMessageHandler: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

function adminDb(opts: { reserve?: { error: { code: string } | null }; existing?: unknown; contact?: unknown; conversation?: unknown }) {
  const chain = (table: string) => {
    const self = {
      insert: vi.fn().mockResolvedValue(opts.reserve ?? { error: null }),
      select: vi.fn(() => self), eq: vi.fn(() => self), order: vi.fn(() => self), limit: vi.fn(() => self),
      maybeSingle: vi.fn().mockResolvedValue(table === "idempotency_keys" ? { data: opts.existing ?? null } : table === "contacts" ? { data: opts.contact ?? null, error: null } : { data: opts.conversation ?? null, error: null }),
      update: vi.fn(() => self), delete: vi.fn(() => self),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve({ error: null })),
    };
    return self;
  };
  return { from: vi.fn((table: string) => chain(table)) };
}

function req(body: unknown, authenticated = true) {
  return new NextRequest("http://localhost/api/internal/notifications/email", {
    method: "POST",
    headers: authenticated
      ? { authorization: "Bearer test-secret", "content-type": "application/json" }
      : { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const valid = {
  message_id: "gmail-1", thread_id: "thread-1", from: "sender@example.com", to: "lumenva.group@gmail.com",
  subject: "Assunto", summary: "Resumo", action: "Agir", deadline: "Amanhã", urgency: "alta", source: "gmail",
};

describe("email notification relay", () => {
  beforeEach(async () => {
    authMock.valid = true; rateMock.allowed = true; envMock.EMAIL_RELAY_DRY_RUN = true;
    const { createAdminClient } = await import("@/lib/supabase/admin");
    vi.mocked(createAdminClient).mockReturnValue(adminDb({}) as never);
  });

  it("rejeita sem autenticação", async () => {
    authMock.valid = false;
    const { POST } = await import("./route");
    expect((await POST(req(valid, false))).status).toBe(401);
  });

  it("rejeita payload inválido", async () => {
    const { POST } = await import("./route");
    expect((await POST(req({ ...valid, summary: "" }))).status).toBe(400);
  });

  it("aplica rate limit", async () => {
    rateMock.allowed = false;
    const { POST } = await import("./route");
    expect((await POST(req(valid))).status).toBe(429);
  });

  it("faz dry-run sem chamar o CRM", async () => {
    const { POST } = await import("./route");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const insert = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) })) }));
    vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn(() => ({ insert, update })) } as never);
    expect((await POST(req(valid))).status).toBe(200);
    expect(insert).toHaveBeenCalled();
  });

  it("suprime duplicidade e rejeita conflito de payload", async () => {
    const { POST } = await import("./route");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const hash = (await import("node:crypto")).createHash("sha256").update(JSON.stringify(valid)).digest("hex");
    vi.mocked(createAdminClient).mockReturnValue(adminDb({ reserve: { error: { code: "23505" } }, existing: { request_hash: "different", response_body: {}, status_code: 200 } }) as never);
    expect((await POST(req(valid))).status).toBe(409);
    vi.mocked(createAdminClient).mockReturnValue(adminDb({ reserve: { error: { code: "23505" } }, existing: { request_hash: hash, response_body: { accepted: true }, status_code: 200 } }) as never);
    expect((await POST(req(valid))).status).toBe(200);
  });

  it("falha quando o dono não está configurado", async () => {
    envMock.EMAIL_RELAY_OWNER_WHATSAPP_E164 = "";
    const { POST } = await import("./route");
    expect((await POST(req(valid))).status).toBe(503);
    envMock.EMAIL_RELAY_OWNER_WHATSAPP_E164 = "+351912345678";
  });

  it("rejeita número resolvido que não corresponde ao dono autorizado", async () => {
    envMock.EMAIL_RELAY_DRY_RUN = false;
    const { POST } = await import("./route");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    vi.mocked(createAdminClient).mockReturnValue(adminDb({ contact: { id: "contact-1", phone_number: "+351911111111" }, conversation: { id: "conversation-1" } }) as never);
    expect((await POST(req({ ...valid, message_id: "gmail-unauthorized" }))).status).toBe(403);
  });

  it("envia pela conversa do dono e propaga falha do canal", async () => {
    envMock.EMAIL_RELAY_DRY_RUN = false;
    const { POST } = await import("./route");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { sendMessageHandler } = await import("@/app/api/v1/messages/_handler");
    vi.mocked(createAdminClient).mockReturnValue(adminDb({ contact: { id: "contact-1", phone_number: "+351912345678" }, conversation: { id: "conversation-1" } }) as never);
    vi.mocked(sendMessageHandler).mockResolvedValue({ id: "crm-1", status: "sent" } as never);
    expect((await POST(req(valid))).status).toBe(200);
    vi.mocked(sendMessageHandler).mockRejectedValue(new Error("channel_500"));
    expect((await POST(req({ ...valid, message_id: "gmail-2" }))).status).toBe(502);
  });
});
