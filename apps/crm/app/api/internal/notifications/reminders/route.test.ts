import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { scheduleCronJob } from "@/lib/agent-engine/cron/scheduler";
import { audit } from "@/lib/audit";

vi.mock("@/lib/env", () => ({ env: { INTERNAL_SECRET: "internal-test-secret" } }));
vi.mock("@/lib/agent-engine/db/request-pool", () => ({ getRequestPool: vi.fn() }));
vi.mock("@/lib/agent-engine/cron/scheduler", () => ({ scheduleCronJob: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

const ORG_ID = "22222222-2222-4222-8222-222222222222";
const CONTACT_ID = "11111111-1111-4111-8111-111111111111";

function request(headers: Record<string, string>, body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/internal/notifications/reminders", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const validBody = {
  contact_id: CONTACT_ID,
  idempotency_key: "reminder-2026-10-01",
  scheduled_at: "2026-10-01T12:00:00.000Z",
};

describe("POST /api/internal/notifications/reminders", () => {
  it("rejects missing internal authentication before opening the database", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({ "x-organization-id": ORG_ID }, validBody));

    expect(response.status).toBe(401);
    expect(getRequestPool).not.toHaveBeenCalled();
  });

  it("does not schedule a reminder for a contact outside the requested tenant", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] }));
    vi.mocked(getRequestPool).mockReturnValue({ query } as never);

    const { POST } = await import("./route");
    const response = await POST(request({
      "x-internal-secret": "internal-test-secret",
      "x-organization-id": ORG_ID,
    }, validBody));

    expect(response.status).toBe(404);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain("from contacts where organization_id = $1 and id = $2");
  });

  it("stores an idempotent reminder and schedules its first delivery", async () => {
    const savedAt = new Date("2026-10-01T12:00:00.000Z");
    const notification = {
      id: "33333333-3333-4333-8333-333333333333",
      organization_id: ORG_ID,
      contact_id: CONTACT_ID,
      idempotency_key: validBody.idempotency_key,
      body: "Tens um lembrete programado. Confere a aplicação para os detalhes.",
      ack_token: "AB23XZ",
      status: "scheduled",
      scheduled_at: savedAt,
      escalation_at: new Date(savedAt.getTime() + 10 * 60_000),
    };
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("from contacts")) return { rows: [{ id: CONTACT_ID }] };
      if (sql.includes("from notification_requests")) return { rows: [] };
      if (sql.includes("from cron_jobs")) return { rows: [] };
      throw new Error(`unexpected pool query: ${sql}`);
    });
    const transactionQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith("select id, organization_id, contact_id, idempotency_key")) return { rows: [] };
      if (sql.includes("count(*)::int as count")) return { rows: [{ count: 0 }] };
      if (sql.includes("insert into notification_requests")) {
        notification.idempotency_key = String(params?.[2]);
        notification.body = String(params?.[3]);
        notification.ack_token = String(params?.[4]);
        notification.scheduled_at = params?.[5] as Date;
        notification.escalation_at = params?.[6] as Date;
        return { rows: [notification] };
      }
      return { rows: [] };
    });
    const pool = {
      query,
      connect: vi.fn(async () => ({ query: transactionQuery, release: vi.fn() })),
    };
    vi.mocked(getRequestPool).mockReturnValue(pool as never);

    const { POST } = await import("./route");
    const response = await POST(request({
      "x-internal-secret": "internal-test-secret",
      "x-organization-id": ORG_ID,
    }, validBody));

    expect(response.status).toBe(200);
    const result = await response.json() as { data: { status: string; acknowledgement: string } };
    expect(result.data.status).toBe("scheduled");
    expect(result.data.acknowledgement).toMatch(/^CONFIRMAR [A-Z0-9]{6}$/);
    expect(transactionQuery).toHaveBeenCalledWith("begin");
    expect(transactionQuery).toHaveBeenCalledWith("commit");
    expect(scheduleCronJob).toHaveBeenCalledOnce();
    expect(audit).toHaveBeenCalledOnce();
  });
});
