import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getRealtimeToken } from "@/app/api/v1/auth/realtime-token/route";
import { GET as getSseEvents } from "@/app/api/v1/realtime/events/route";
import { NextRequest } from "next/server";
import { fail } from "@/lib/api/wrappers";
import type { RoleCheck } from "@/lib/auth/require-role";
import type { EventRow } from "@/lib/event-log/dispatcher";

vi.mock("@/lib/firebase/server", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    uid: "test-uid",
    email: "test@example.com",
  }),
}));

vi.mock("@/lib/auth/require-role", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/realtime/event-bus", () => ({
  pollEvents: vi.fn(),
}));

vi.mock("@/lib/realtime/sse", () => ({
  createSSEStream: vi.fn(),
}));

describe("realtime API migration", () => {
  it("realtime-token route returns 410 Gone", async () => {
    const req = new NextRequest("http://localhost/api/v1/auth/realtime-token");
    const res = await getRealtimeToken(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error.code).toBe("gone");
  });
});

describe("SSE Realtime server boundary", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
  });

  it("fails with 401 if unauthenticated (no firebase session)", async () => {
    const { requireRole } = await import("@/lib/auth/require-role");
    vi.mocked(requireRole).mockResolvedValueOnce({
      ok: false,
      response: fail("unauthenticated", "Auth failed", 401, { headers: { "cache-control": "no-store, max-age=0" } }),
    } as RoleCheck);

    const req = new NextRequest("http://localhost/api/v1/realtime/events?organization_id=org-1");
    const res = await getSseEvents(req);

    expect(res.status).toBe(401);
  });

  it("fails with 403 if invalid F1/F2 mapping", async () => {
    const { requireRole } = await import("@/lib/auth/require-role");
    vi.mocked(requireRole).mockResolvedValueOnce({
      ok: false,
      response: fail("forbidden_tenant", "No org", 403, { headers: { "cache-control": "no-store, max-age=0" } }),
    } as RoleCheck);

    const req = new NextRequest("http://localhost/api/v1/realtime/events?organization_id=some-org");
    const res = await getSseEvents(req);

    expect(res.status).toBe(403);
  });

  it("rejects without valid organization_id query", async () => {
    const req = new NextRequest("http://localhost/api/v1/realtime/events");
    const res = await getSseEvents(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_request");
  });

  it("polls and returns SSE stream with valid auth", async () => {
    const { requireRole } = await import("@/lib/auth/require-role");
    vi.mocked(requireRole).mockResolvedValueOnce({
      ok: true,
      user: { id: "u-1" },
      org: { orgId: "o-1", name: "Org", role: "viewer" }
    } as unknown as RoleCheck);

    const { pollEvents } = await import("@/lib/realtime/event-bus");
    const mockPollResponse: (EventRow & { created_at: string })[] = [{
        id: "ev-1",
        organization_id: "o-1",
        event_type: "test.event",
        entity_kind: "test",
        entity_id: "t-1",
        payload: { msg: "hello" },
        metadata: {},
        consumed_by: [],
        attempts: 0,
        created_at: new Date().toISOString()
      }];
    vi.mocked(pollEvents).mockResolvedValueOnce(mockPollResponse);

    const { createSSEStream } = await import("@/lib/realtime/sse");
    vi.mocked(createSSEStream).mockReturnValueOnce(
      new Response("data: test\n\n", {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store, max-age=0"
        }
      })
    );

    const req = new NextRequest("http://localhost/api/v1/realtime/events?organization_id=o-1");
    const res = await getSseEvents(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-store, max-age=0");

    const body = await res.text();
    expect(body).toBe("data: test\n\n");
    expect(vi.mocked(createSSEStream).mock.calls[0]?.[3]).toEqual({
      userId: "u-1",
      role: "viewer",
    });
  });
});
