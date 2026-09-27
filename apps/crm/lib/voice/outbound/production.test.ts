import type pg from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";

import { dialProductionVoiceRoute, resolveProductionVoiceOutboundRoute } from "./production";
import type { VoiceOutboundRoute } from "./service";

const asteriskRows = [{
  control_url: "https://voice.internal/",
  phone_e164: "+37255501234",
  external_connection_id: "sip-connection-1",
}];

function pool(query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>): pg.Pool {
  return { query } as unknown as pg.Pool;
}

afterEach(() => vi.unstubAllGlobals());

describe("production voice route selection", () => {
  it("selects a single verified, tenant-scoped Asterisk route", async () => {
    const query = vi.fn(async (sql: string, _values?: unknown[]) => ({
      rows: sql.includes("voice_sip_connections") ? asteriskRows : [],
    }));

    await expect(resolveProductionVoiceOutboundRoute(pool(query), "org-1")).resolves.toEqual({
      provider: "asterisk",
      endpoint: "https://voice.internal",
      phoneE164: "+37255501234",
      connectionId: "sip-connection-1",
    } satisfies VoiceOutboundRoute);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain("vsc.verified = true");
    expect(query.mock.calls[0]?.[0]).toContain("vpn.ownership_verified_at is not null");
    expect(query.mock.calls[0]?.[1]).toEqual(["org-1"]);
  });

  it("does not fall back to Telnyx when multiple verified Asterisk routes are ambiguous", async () => {
    const query = vi.fn(async (sql: string, _values?: unknown[]) => ({
      rows: sql.includes("select count(*)")
        ? [{ count: "2" }]
        : sql.includes("voice_sip_connections")
          ? [...asteriskRows, ...asteriskRows]
          : [{ control_url: "https://telnyx.internal", phone_e164: "+351211234567" }],
    }));

    await expect(resolveProductionVoiceOutboundRoute(pool(query), "org-1")).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(2);
  });
});

describe("production voice worker request", () => {
  it("sends only the provider-bound call fields to the selected worker", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetch);

    await dialProductionVoiceRoute({
      provider: "asterisk",
      endpoint: "https://voice.internal",
      phoneE164: "+37255501234",
      connectionId: "sip-connection-1",
    }, "internal-test-secret", {
      voiceCallId: "11111111-1111-4111-8111-111111111111",
      organizationId: "org-1",
      contactId: "contact-1",
      agentId: "notification-router",
      goal: "deliver_scheduled_notification",
      toE164: "+351912345678",
      firstMessage: "Tens um lembrete programado.",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://voice.internal/v1/calls");
    expect(new Headers((init as RequestInit).headers).get("x-internal-secret")).toBe("internal-test-secret");
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      voice_call_id: "11111111-1111-4111-8111-111111111111",
      organization_id: "org-1",
      provider: "asterisk",
      connection_id: "sip-connection-1",
      to_e164: "+351912345678",
      first_message: "Tens um lembrete programado.",
    });
  });

  it("surfaces a rejected worker response so the caller can keep the attempt durable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(dialProductionVoiceRoute({
      provider: "telnyx",
      endpoint: "https://voice.internal",
      phoneE164: "+351211234567",
      connectionId: null,
    }, "internal-test-secret", {
      voiceCallId: "11111111-1111-4111-8111-111111111111",
      organizationId: "org-1",
      contactId: "contact-1",
      agentId: "notification-router",
      goal: "Reminder",
      toE164: "+351912345678",
      firstMessage: "Tens um lembrete programado.",
    })).rejects.toThrow("voice_worker_http_503");
  });
});
