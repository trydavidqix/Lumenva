import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { scheduleCronJob } from "@/lib/agent-engine/cron/scheduler";

/**
 * Fase 3 (quinta fatia): app/api/internal/voice/event aceita agora um
 * segundo caminho de binding de tenant (connection_id + phone_e164, mundo
 * SIP/BYOC), aditivo ao caminho Telnyx existente (technical_phone_e164).
 * Nenhuma das duas rotas confia em organization_id vindo do corpo — ambas
 * resolvem via join no banco, como o caminho Telnyx já fazia.
 */

vi.mock("@/lib/env", () => ({ env: { INTERNAL_SECRET: "segredo-de-teste", INTERNAL_CRON_SECRET: "" } }));
vi.mock("@/lib/agent-engine/db/request-pool", () => ({ getRequestPool: vi.fn() }));
vi.mock("@/lib/agent-engine/cron/scheduler", () => ({ scheduleCronJob: vi.fn() }));

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

function makePoolStub(options: {
  bindRow: Record<string, unknown> | null;
  updateRow: Record<string, unknown> | null;
  eventRow?: Record<string, unknown> | null;
  notificationRow?: Record<string, unknown> | null;
  deliveryPolicy?: Record<string, unknown> | null;
  attemptCount?: number;
  existingJob?: Record<string, unknown> | null;
}): PoolStub {
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
    if (sql.includes("from notification_requests") && sql.includes("voice_call_id")) {
      return { rows: options.notificationRow ? [options.notificationRow] : [] };
    }
    if (sql.includes("from notification_delivery_policies")) {
      return { rows: options.deliveryPolicy ? [options.deliveryPolicy] : [] };
    }
    if (sql.includes("count(*)::int as count")) {
      return { rows: [{ count: options.attemptCount ?? 0 }] };
    }
    if (sql.includes("from cron_jobs")) {
      return { rows: options.existingJob ? [options.existingJob] : [] };
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
  it("does not acknowledge a notification when the voice call becomes active", async () => {
    vi.mocked(scheduleCronJob).mockReset();
    const pool = makePoolStub({
      bindRow: { organization_id: ORG_ID },
      updateRow: { id: VOICE_CALL_ID },
      notificationRow: { id: "notification-1", organization_id: ORG_ID, contact_id: "contact-1", status: "voice_pending" },
    });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(req({
      ...baseBody,
      connection_id: "sip-conn-abc",
      phone_e164: "+351211234567",
    }));

    expect(res.status).toBe(200);
    const deliveryUpdate = pool.query.mock.calls.find(([sql]) => sql.includes("update notification_delivery_attempts"));
    expect(deliveryUpdate?.[0]).toContain("status = 'delivered'");
    expect(pool.query.mock.calls.some(([sql]) => sql.includes("status = 'acknowledged'") || sql.includes("status = 'completed'"))).toBe(false);
    expect(scheduleCronJob).not.toHaveBeenCalled();
  });

  it("completes the notification after a terminal successful voice event", async () => {
    vi.mocked(scheduleCronJob).mockReset();
    const pool = makePoolStub({
      bindRow: { organization_id: ORG_ID },
      updateRow: { id: VOICE_CALL_ID },
      notificationRow: { id: "notification-1", organization_id: ORG_ID, contact_id: "contact-1", status: "voice_pending" },
    });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(req({
      ...baseBody,
      state: "completed",
      connection_id: "sip-conn-abc",
      phone_e164: "+351211234567",
    }));

    expect(res.status).toBe(200);
    const requestUpdate = pool.query.mock.calls.find(([sql]) => sql.includes("update notification_requests"));
    expect(requestUpdate?.[0]).toContain("status = 'completed'");
    expect(scheduleCronJob).not.toHaveBeenCalled();
  });

  it("schedules one policy-bounded retry after a failed voice event", async () => {
    vi.mocked(scheduleCronJob).mockReset();
    const pool = makePoolStub({
      bindRow: { organization_id: ORG_ID },
      updateRow: { id: VOICE_CALL_ID },
      notificationRow: { id: "notification-1", organization_id: ORG_ID, contact_id: "contact-1", status: "voice_pending" },
      deliveryPolicy: { voice_max_attempts: 3, voice_cooldown_seconds: 120 },
      attemptCount: 1,
    });
    vi.mocked(getRequestPool).mockReturnValue(pool as unknown as ReturnType<typeof getRequestPool>);

    const { POST } = await import("./route");
    const res = await POST(req({
      ...baseBody,
      state: "failed",
      occurred_at: "2026-09-29T00:00:00.000Z",
      connection_id: "sip-conn-abc",
      phone_e164: "+351211234567",
    }));

    expect(res.status).toBe(200);
    const requestUpdate = pool.query.mock.calls.find(([sql]) => sql.includes("update notification_requests"));
    expect(requestUpdate?.[0]).toContain("status = 'voice_pending'");
    expect(scheduleCronJob).toHaveBeenCalledTimes(1);
    expect(scheduleCronJob).toHaveBeenCalledWith(
      pool,
      ORG_ID,
      expect.objectContaining({
        leadId: "contact-1",
        jobKind: "notification_delivery",
        payload: { notification_id: "notification-1", phase: "voice" },
        spec: expect.objectContaining({ kind: "at", at: expect.any(Date) }),
      }),
    );
    const scheduledAt = vi.mocked(scheduleCronJob).mock.calls[0]?.[2].spec;
    expect(scheduledAt).toMatchObject({ kind: "at", at: new Date("2026-09-29T00:02:00.000Z") });
  });

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
