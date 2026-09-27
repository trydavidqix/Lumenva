import type { JobRow } from "@/lib/agent-engine/queue/queue";
import { describe, expect, it, vi } from "vitest";

import { dialProductionVoiceRoute, resolveProductionVoiceOutboundRoute } from "@/lib/voice/outbound/production";
import { createNotificationDeliveryHandler } from "./worker";

vi.mock("@/lib/voice/outbound/production", () => ({
  dialProductionVoiceRoute: vi.fn(),
  resolveProductionVoiceOutboundRoute: vi.fn(),
}));
vi.mock("@/app/api/v1/messages/_handler", () => ({ sendMessageHandler: vi.fn() }));

const row = {
  id: "33333333-3333-4333-8333-333333333333",
  organization_id: "22222222-2222-4222-8222-222222222222",
  contact_id: "11111111-1111-4111-8111-111111111111",
  body: "Tens um lembrete programado. Confere a aplicação para os detalhes.",
  ack_token: "AB23XZ",
  status: "voice_pending",
  scheduled_at: new Date("2026-10-01T12:00:00Z"),
  escalation_at: new Date("2026-10-01T12:10:00Z"),
  whatsapp_message_id: null,
  voice_call_id: null,
};

function job(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: "job-1",
    organization_id: row.organization_id,
    contact_id: row.contact_id,
    payload: { notification_id: row.id, phase: "voice" },
    ...overrides,
  } as JobRow;
}

function pool(query: unknown) {
  return { query } as unknown as import("pg").Pool;
}

describe("notification delivery worker safety gates", () => {
  it("refuses jobs while the router feature flag is disabled", async () => {
    const query = vi.fn();
    const handler = createNotificationDeliveryHandler({
      supabaseUrl: "http://127.0.0.1:54321",
      serviceRoleKey: "test-service-role-key",
      routerEnabled: false,
      voiceEnabled: true,
    });

    await expect(handler(job(), pool(query))).rejects.toThrow("notification_router_disabled");
    expect(query).not.toHaveBeenCalled();
  });

  it("never dials voice when voice delivery is disabled", async () => {
    const query = vi.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes("from notification_requests")) return { rows: [row] };
      if (sql.includes("max(attempt)")) return { rows: [{ next_attempt: 1 }] };
      return { rows: [] };
    });
    const handler = createNotificationDeliveryHandler({
      supabaseUrl: "http://127.0.0.1:54321",
      serviceRoleKey: "test-service-role-key",
      routerEnabled: true,
      voiceEnabled: false,
    });

    await handler(job(), pool(query));

    expect(dialProductionVoiceRoute).not.toHaveBeenCalled();
    expect(resolveProductionVoiceOutboundRoute).not.toHaveBeenCalled();
    expect(query.mock.calls.some(([, params]) => params?.includes("voice_notification_disabled"))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("notification_delivery_attempts"))).toBe(true);
  });

  it("rejects a notification row outside the job's tenant/contact binding", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] }));
    const handler = createNotificationDeliveryHandler({
      supabaseUrl: "http://127.0.0.1:54321",
      serviceRoleKey: "test-service-role-key",
      routerEnabled: true,
      voiceEnabled: true,
    });

    await expect(handler(job(), pool(query))).rejects.toThrow("notification_not_found_or_cross_tenant");
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0]?.[0])).toContain("organization_id = $2 and contact_id = $3");
  });
});
