import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { getAgentCommandRuntime } from "@/lib/ai/agent-command/runtime";
import { AgentCommandError } from "@/lib/ai/agent-command/service";
import type { AuthUser } from "@/lib/auth/types";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/ai/agent-command/runtime", () => ({ getAgentCommandRuntime: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

const ORG = "22222222-2222-4222-8222-222222222222";
const USER = "11111111-1111-4111-8111-111111111111";
const AGENT = "33333333-3333-4333-8333-333333333333";
const IDEMPOTENCY = "77777777-7777-4777-8777-777777777777";

function request(body: unknown, idempotencyKey: string | null = IDEMPOTENCY) {
  const headers = new Headers({ "content-type": "application/json" });
  if (idempotencyKey !== null) headers.set("idempotency-key", idempotencyKey);
  return new NextRequest(`http://localhost/api/v1/ai/agents/${AGENT}/command`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/ai/agents/:id/command", () => {
  const submit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    const user: AuthUser = {
      id: USER,
      email: "manager@example.test",
      full_name: null,
      avatar_url: null,
      is_platform_admin: false,
      organizations: [{ organization_id: ORG, organization_name: "Org", role: "manager" }],
    };
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user,
      org: { orgId: ORG, name: "Org", role: "manager" },
    });
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, count: 1, limit: 30, window_sec: 60 });
    vi.mocked(getAgentCommandRuntime).mockReturnValue({ submit } as never);
    submit.mockResolvedValue({ status: "answer", message: "Olá.", traceId: "trace" });
  });

  it("rejects malformed input before starting command analysis", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({ command: "" }), {
      params: Promise.resolve({ id: AGENT }),
    });

    expect(response.status).toBe(422);
    expect(submit).not.toHaveBeenCalled();
  });

  it("requires a UUID Idempotency-Key", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({ command: "liste os leads" }, null), {
      params: Promise.resolve({ id: AGENT }),
    });

    expect(response.status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });

  it("uses the authenticated organization and user, never tenant data from the body", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({ command: "liste os leads" }), {
      params: Promise.resolve({ id: AGENT }),
    });

    expect(response.status).toBe(200);
    expect(requireRole).toHaveBeenCalledWith("manager", expect.objectContaining({ resource: "ai_agents" }));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        userId: USER,
        agentId: AGENT,
        command: "liste os leads",
        idempotencyKey: IDEMPOTENCY,
      }),
    );
  });

  it("maps a denied tool proposal to the canonical API error envelope", async () => {
    submit.mockRejectedValueOnce(new AgentCommandError("tool_not_allowed", 403));
    const { POST } = await import("./route");
    const response = await POST(request({ command: "apague tudo" }), {
      params: Promise.resolve({ id: AGENT }),
    });
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("tool_not_allowed");
  });

  it("returns auth failures before rate limit or runtime access", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: { code: "unauthenticated", message: "Auth required." } }, { status: 401 }),
    } as never);
    const { POST } = await import("./route");
    const response = await POST(request({ command: "liste os leads" }), {
      params: Promise.resolve({ id: AGENT }),
    });

    expect(response.status).toBe(401);
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });
});
