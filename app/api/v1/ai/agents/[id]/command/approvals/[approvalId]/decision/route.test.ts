import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { getAgentCommandRuntime } from "@/lib/ai/agent-command/runtime";
import { AgentCommandError } from "@/lib/ai/agent-command/service";
import type { AuthUser } from "@/lib/auth/types";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/ai/agent-command/runtime", () => ({ getAgentCommandRuntime: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

const ORG = "22222222-2222-4222-8222-222222222222";
const USER = "11111111-1111-4111-8111-111111111111";
const AGENT = "33333333-3333-4333-8333-333333333333";
const APPROVAL = "55555555-5555-4555-8555-555555555555";

function request(body: unknown) {
  return new NextRequest("http://localhost/decision", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/ai/agents/:id/command/approvals/:approvalId/decision", () => {
  const decide = vi.fn();

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
    vi.mocked(getAgentCommandRuntime).mockReturnValue({ decide } as never);
    decide.mockResolvedValue({ status: "denied", approvalId: APPROVAL, traceId: "trace" });
  });

  it("rejects an unsupported decision", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({ decision: "later" }), {
      params: Promise.resolve({ id: AGENT, approvalId: APPROVAL }),
    });

    expect(response.status).toBe(422);
    expect(decide).not.toHaveBeenCalled();
  });

  it("passes only the authenticated tenant and actor into the decision service", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({ decision: "deny", reason: "não agora" }), {
      params: Promise.resolve({ id: AGENT, approvalId: APPROVAL }),
    });

    expect(response.status).toBe(200);
    expect(decide).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        userId: USER,
        agentId: AGENT,
        approvalId: APPROVAL,
        decision: "deny",
        reason: "não agora",
      }),
    );
  });

  it("returns not_found for a cross-tenant approval without leaking its state", async () => {
    decide.mockRejectedValueOnce(new AgentCommandError("approval_not_found", 404));
    const { POST } = await import("./route");
    const response = await POST(request({ decision: "approve" }), {
      params: Promise.resolve({ id: AGENT, approvalId: APPROVAL }),
    });
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("approval_not_found");
  });
});
