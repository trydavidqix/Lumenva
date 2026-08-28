import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";

/**
 * Fase 3 (quinta fatia): app/api/internal/voice/event aceita agora um
 * segundo caminho de binding de tenant (connection_id + phone_e164, mundo
 * SIP/BYOC), aditivo ao caminho Telnyx existente (technical_phone_e164).
 * Nenhuma das duas rotas confia em organization_id vindo do corpo — ambas
 * resolvem via join no banco, como o caminho Telnyx já fazia.
 */

vi.mock("@/lib/env", () => ({ env: { INTERNAL_SECRET: "segredo-de-teste", INTERNAL_CRON_SECRET: "" } }));
vi.mock("@/lib/agent-engine/db/request-pool", () => ({ getRequestPool: vi.fn() }));

const VOICE_CALL_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";

function req(body: Record<string, unknown>, secret = "segredo-de-teste") {
  return new NextRequest("http://localhost/api/internal/voice/event", {
    method: "POST",
    headers: { "x-internal-secret": secret },
    body: JSON.stringify(body),
  });
}

interface PoolStub {
  query: ReturnType<typeof vi.fn>;
}

function makePoolStub(options: { bindRow: Record<string, unknown> | null; updateRow: Record<string, unknown> | null; eventRow?: Record<string, unknown> | null }): PoolStub {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("from voice_calls vc") && sql.includes("join voice_sip_connections") ) {
      return { rows: options.bindRow ? [options.bindRow] : [] };
    }
    if (sql.includes("from voice_calls vc") && sql.includes("join voice_phone_numbers")) {
      return { rows: options.bindRow ? [options.bindRow] : [] };
    }
    if (sql.trim().startsWith("update voice_calls")) {
      return { rows: options.updateRow ? [options.updateRow] : [] };
    }
    if (sql.includes("from voice_call_events") && sql.trim().startsWith("select")) {
      return { rows: options.eventRow ? [options.eventRow] : [] };
    }
    if (sql.trim().startsWith("insert into voice_call_events")) {
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });
  return { query };
}

const baseBody = {
  voice_call_id: VOICE_CALL_ID,
  state: "active" as const,
  provider_event_id: "evt-1",
};

describe("POST /api/internal/voice/event — SIP/BYOC binding (Fase 3)", () => {
  it("binds by connection_id + phone_e164 and records the event, same as the Telnyx path", async () => {
    const pool = makePoolStub({ bindRow: { organization_id: ORG_ID }, updateRow: { id: VOICE_CALL_ID } });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(req({ ...baseBody, connection_id: "sip-conn-abc", phone_e164: "+351211234567" }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { recorded: boolean } };
    expect(body.data.recorded).toBe(true);

    const bindCall = pool.query.mock.calls.find(([sql]) => sql.includes("voice_sip_connections"));
    expect(bindCall?.[1]).toEqual([VOICE_CALL_ID, "sip-conn-abc", "+351211234567"]);
    expect(bindCall?.[0]).toContain("vsc.gateway = 'asterisk'");
    expect(bindCall?.[0]).toContain("vsc.verified = true");

    const updateCall = pool.query.mock.calls.find(([sql]) => sql.trim().startsWith("update voice_calls"));
    expect(updateCall?.[1][1]).toBe(ORG_ID); // organization_id came from the join, never from the request body
  });

  it("rejects when the SIP connection/number binding does not resolve any call", async () => {
    const pool = makePoolStub({ bindRow: null, updateRow: null });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(req({ ...baseBody, connection_id: "unknown-conn", phone_e164: "+351211234567" }));

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("voice_call_not_found");
  });

  it("rejects a body with neither technical_phone_e164 nor connection_id", async () => {
    const pool = makePoolStub({ bindRow: null, updateRow: null });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(req({ ...baseBody }));

    expect(res.status).toBe(422);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("rejects a body with both technical_phone_e164 and connection_id", async () => {
    const pool = makePoolStub({ bindRow: null, updateRow: null });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(
      req({ ...baseBody, technical_phone_e164: "+351911234567", connection_id: "sip-conn-abc", phone_e164: "+351211234567" }),
    );

    expect(res.status).toBe(422);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("rejects connection_id without phone_e164", async () => {
    const pool = makePoolStub({ bindRow: null, updateRow: null });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(req({ ...baseBody, connection_id: "sip-conn-abc" }));

    expect(res.status).toBe(422);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("still accepts the legacy technical_phone_e164-only body untouched", async () => {
    const pool = makePoolStub({ bindRow: { organization_id: ORG_ID }, updateRow: { id: VOICE_CALL_ID } });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(req({ ...baseBody, technical_phone_e164: "+351911234567" }));

    expect(res.status).toBe(200);
    const bindCall = pool.query.mock.calls.find(([sql]) => sql.includes("voice_phone_numbers") && !sql.includes("voice_sip_connections"));
    expect(bindCall?.[1]).toEqual([VOICE_CALL_ID, "+351911234567"]);
  });

  it("does not let a duplicate provider event mutate the call lifecycle", async () => {
    const pool = makePoolStub({ bindRow: { organization_id: ORG_ID }, updateRow: null, eventRow: { id: "event-1" } });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(req({
      ...baseBody,
      state: "failed",
      connection_id: "sip-conn-abc",
      phone_e164: "+351211234567",
      provider_event_id: "evt-already-recorded",
    }));

    expect(res.status).toBe(200);
    const updateCall = pool.query.mock.calls.find(([sql]) => sql.trim().startsWith("update voice_calls"));
    expect(updateCall?.[0]).toContain("not exists");
    expect(updateCall?.[0]).toContain("voice_call_events");
    expect(updateCall?.[1]).toContain("evt-already-recorded");
  });

  it("rejects unauthenticated requests before touching the database", async () => {
    const pool = makePoolStub({ bindRow: null, updateRow: null });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(req({ ...baseBody, connection_id: "sip-conn-abc", phone_e164: "+351211234567" }, "wrong-secret"));

    expect(res.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
