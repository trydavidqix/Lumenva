import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";

vi.mock("@/lib/env", () => ({ env: { INTERNAL_SECRET: "test-secret" } }));
vi.mock("@/lib/agent-engine/db/request-pool", () => ({ getRequestPool: vi.fn() }));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, count: 1, limit: 1200, window_sec: 60 })),
}));
vi.mock("@/lib/voice/runtime/kernel-runtime", () => ({ createVoiceProductionKernel: vi.fn() }));
vi.mock("@/lib/voice/runtime/delivery-policy", () => ({ createProductAgentVoiceDeliveryAuthorizer: vi.fn() }));
const TURN_RESULT = {
  kind: "reply",
  text: "ok",
  agentId: "atendimento",
  runId: "r",
  traceId: "t",
  delivery: { affect: "empathetic", pace: "slow", energy: 0.35, tone: "warm" },
} as const;
vi.mock("@/lib/voice/runtime/turn-service", () => ({
  createVoiceTurnService: () => ({ run: vi.fn().mockResolvedValue(TURN_RESULT) }),
}));

const ORG_ID = "22222222-2222-4222-8222-222222222222";
const VOICE_CALL_ID = "33333333-3333-4333-8333-333333333333";
const SIP_CONN_ID = "44444444-4444-4444-8444-444444444444";

function req(body: Record<string, unknown>, secret = "test-secret") {
  return new NextRequest("http://localhost/api/internal/voice/turn", {
    method: "POST",
    headers: { "x-internal-secret": secret },
    body: JSON.stringify(body),
  });
}

interface PoolStub { query: ReturnType<typeof vi.fn>; }

function makePoolStub(options: { callRow?: Record<string, unknown> | null; sipConnectionRow?: Record<string, unknown> | null }): PoolStub {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("from voice_calls vc")) return { rows: options.callRow ? [options.callRow] : [] };
    if (sql.includes("from voice_sip_connections")) return { rows: options.sipConnectionRow ? [options.sipConnectionRow] : [] };
    throw new Error(`unexpected query: ${sql}`);
  });
  return { query };
}

const baseBody = { voice_call_id: VOICE_CALL_ID, technical_phone_e164: "+351210000000", transcript: "olá" };

describe("POST /api/internal/voice/turn", () => {
  it("returns delivery metadata unchanged to the media worker", async () => {
    const pool = makePoolStub({ callRow: { organization_id: ORG_ID, contact_id: null } });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);
    const { POST } = await import("./route");
    const res = await POST(req(baseBody));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof TURN_RESULT };
    expect(body.data).toEqual(TURN_RESULT);
  });

  it("accepts an active call with provider=asterisk and verified enabled connection", async () => {
    const pool = makePoolStub({ callRow: { organization_id: ORG_ID, contact_id: null }, sipConnectionRow: { id: SIP_CONN_ID, verified: true, enabled: true } });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);
    const { POST } = await import("./route");
    const res = await POST(req(baseBody));
    expect(res.status).toBe(200);
    const [sql] = pool.query.mock.calls[0]!;
    expect(sql).toMatch(/vpn\.provider = 'telnyx'/);
    expect(sql).toMatch(/vpn\.provider = 'asterisk'/);
    expect(sql).toMatch(/vsc\.verified = true/);
    expect(sql).toMatch(/vsc\.enabled = true/);
  });

  it("rejects asterisk call when SIP connection is not verified", async () => {
    const pool = makePoolStub({ callRow: null, sipConnectionRow: { id: SIP_CONN_ID, verified: false, enabled: true } });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);
    const { POST } = await import("./route");
    const res = await POST(req(baseBody));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("voice_call_not_active");
  });

  it("accepts telnyx call without checking SIP connection", async () => {
    const pool = makePoolStub({ callRow: { organization_id: ORG_ID, contact_id: null } });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);
    const { POST } = await import("./route");
    const res = await POST(req(baseBody));
    expect(res.status).toBe(200);
  });

  it("rejects unauthenticated requests before touching the database", async () => {
    const pool = makePoolStub({});
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);
    const { POST } = await import("./route");
    const res = await POST(req(baseBody, "wrong-secret"));
    expect(res.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("returns 409 when call is not found or not active", async () => {
    const pool = makePoolStub({ callRow: null });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);
    const { POST } = await import("./route");
    const res = await POST(req(baseBody));
    expect(res.status).toBe(409);
  });

  it("rejects when rate limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, count: 1201, limit: 1200, window_sec: 60 });
    const pool = makePoolStub({});
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);
    const { POST } = await import("./route");
    const res = await POST(req(baseBody));
    expect(res.status).toBe(429);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("rejects invalid body", async () => {
    const pool = makePoolStub({});
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);
    const { POST } = await import("./route");
    const res = await POST(req({ voice_call_id: "not-a-uuid", technical_phone_e164: "+invalid", transcript: "" }));
    expect(res.status).toBe(422);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
