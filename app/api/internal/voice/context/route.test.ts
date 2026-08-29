import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";

/**
 * Fase 3 (sexta fatia): app/api/internal/voice/context aceita agora um
 * segundo caminho de resolução de tenant (connection_id, mundo SIP/BYOC),
 * aditivo ao caminho Telnyx existente (resolução por número técnico). É a
 * peça que faltava para o listener SIP (asterisk-listener.ts) algum dia ter
 * um voice_call_id real para encaminhar a app/api/internal/voice/event.
 */

vi.mock("@/lib/env", () => ({ env: { INTERNAL_SECRET: "segredo-de-teste", INTERNAL_CRON_SECRET: "" } }));
vi.mock("@/lib/agent-engine/db/request-pool", () => ({ getRequestPool: vi.fn() }));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, count: 1, limit: 600, window_sec: 60 })),
}));

const ORG_ID = "22222222-2222-4222-8222-222222222222";
const VOICE_CALL_ID = "33333333-3333-4333-8333-333333333333";

function req(body: Record<string, unknown>, secret = "segredo-de-teste") {
  return new NextRequest("http://localhost/api/internal/voice/context", {
    method: "POST",
    headers: { "x-internal-secret": secret },
    body: JSON.stringify(body),
  });
}

interface PoolStub {
  query: ReturnType<typeof vi.fn>;
}

function makePoolStub(options: {
  connectionRow?: Record<string, unknown> | null;
  numberRow?: Record<string, unknown> | null;
  telnyxOrgRow?: Record<string, unknown> | null;
  callerRow?: Record<string, unknown> | null;
  insertRow?: Record<string, unknown> | null;
  settingsRow?: Record<string, unknown> | null;
}): PoolStub {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("from voice_sip_connections")) {
      return { rows: options.connectionRow ? [options.connectionRow] : [] };
    }
    if (sql.includes("from voice_phone_numbers") && sql.includes("connection_id = $1")) {
      return { rows: options.numberRow ? [options.numberRow] : [] };
    }
    if (sql.includes("from voice_phone_numbers") && sql.includes("provider = $1")) {
      return { rows: options.telnyxOrgRow ? [options.telnyxOrgRow] : [] };
    }
    if (sql.trim().startsWith("select id") && sql.includes("from contacts")) {
      return { rows: options.callerRow ? [options.callerRow] : [] };
    }
    if (sql.trim().startsWith("insert into voice_calls")) {
      return { rows: options.insertRow ? [options.insertRow] : [] };
    }
    if (sql.trim().startsWith("select settings from organizations")) {
      return { rows: options.settingsRow ? [options.settingsRow] : [{ settings: {} }] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });
  return { query };
}

const baseBody = { provider_call_id: "channel-abc", direction: "inbound" as const };

describe("POST /api/internal/voice/context — SIP/BYOC path (Fase 3)", () => {
  it("resolves a new inbound SIP call via connection_id and persists provider='asterisk'", async () => {
    const pool = makePoolStub({
      connectionRow: { id: "conn-row-1", organization_id: ORG_ID },
      numberRow: { organization_id: ORG_ID },
      callerRow: null,
      insertRow: { id: VOICE_CALL_ID },
    });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(
      req({ ...baseBody, connection_id: "sip-conn-abc", caller_e164: "+351911234567", called_e164: "+351211234567" }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { voice_call_id: string; caller_kind: string } };
    expect(body.data.voice_call_id).toBe(VOICE_CALL_ID);
    expect(body.data.caller_kind).toBe("unknown");

    const insertCall = pool.query.mock.calls.find(([sql]) => sql.trim().startsWith("insert into voice_calls"));
    expect(insertCall?.[0]).toContain("'asterisk'");
    expect(insertCall?.[1]).toEqual([ORG_ID, null, "inbound", "+351911234567", "+351211234567", "channel-abc"]);

    const connectionQuery = pool.query.mock.calls.find(([sql]) => sql.includes("voice_sip_connections"));
    expect(connectionQuery?.[1]).toEqual(["asterisk", "sip-conn-abc"]);
  });

  it("rejects when the SIP connection is unknown/unverified", async () => {
    const pool = makePoolStub({ connectionRow: null });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(
      req({ ...baseBody, connection_id: "unknown-conn", caller_e164: "+351911234567", called_e164: "+351211234567" }),
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/not owned by a verified tenant/i);
  });

  it("rejects when the number is not registered under the verified connection", async () => {
    const pool = makePoolStub({ connectionRow: { id: "conn-row-1", organization_id: ORG_ID }, numberRow: null });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(
      req({ ...baseBody, connection_id: "sip-conn-abc", caller_e164: "+351911234567", called_e164: "+351211234567" }),
    );

    expect(res.status).toBe(409);
  });

  it("still resolves the legacy Telnyx path untouched (no connection_id)", async () => {
    const pool = makePoolStub({
      telnyxOrgRow: { organization_id: ORG_ID },
      callerRow: null,
      insertRow: { id: VOICE_CALL_ID },
    });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(req({ ...baseBody, caller_e164: "+351911234567", called_e164: "+351211234567" }));

    expect(res.status).toBe(200);
    const insertCall = pool.query.mock.calls.find(([sql]) => sql.trim().startsWith("insert into voice_calls"));
    expect(insertCall?.[0]).toContain("'telnyx'");
  });

  it("rejects unauthenticated requests before touching the database", async () => {
    const pool = makePoolStub({});
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(
      req({ ...baseBody, connection_id: "sip-conn-abc", caller_e164: "+351911234567", called_e164: "+351211234567" }, "wrong"),
    );

    expect(res.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("does not return database/provider error details to the worker", async () => {
    const pool = makePoolStub({ connectionRow: { id: "conn-row-1", organization_id: ORG_ID }, numberRow: { organization_id: ORG_ID } });
    pool.query.mockImplementationOnce(async () => {
      throw new Error("password=super-secret database connection failed");
    });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(req({
      ...baseBody,
      connection_id: "sip-conn-abc",
      caller_e164: "+351911234567",
      called_e164: "+351211234567",
    }));
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).not.toContain("super-secret");
    expect(body.error.message).toBe("Não foi possível resolver o contexto de voz.");
  });

  it("rejects when rate limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, count: 601, limit: 600, window_sec: 60 });
    const pool = makePoolStub({});
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(
      req({ ...baseBody, connection_id: "sip-conn-abc", caller_e164: "+351911234567", called_e164: "+351211234567" }),
    );

    expect(res.status).toBe(429);
  });
});
