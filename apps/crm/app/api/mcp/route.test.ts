import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/mcp/server", () => ({ createMcpServer: vi.fn() }));
vi.mock("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js", () => ({
  WebStandardStreamableHTTPServerTransport: class {
    async handleRequest() {
      return new Response("{}", { status: 200 });
    }
  },
}));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/mcp/auth-rate-limit", () => ({
  MCP_AUTH_RATE_LIMIT: 30,
  MCP_AUTH_RATE_WINDOW_SEC: 60,
  MCP_RATE_LIMIT: 120,
  MCP_RATE_WINDOW_SEC: 60,
  mcpAuthAttemptAllowed: vi.fn(),
  recordMcpAuthFailure: vi.fn(),
}));
vi.mock("@/lib/mcp/auth", () => {
  class MockMcpAuthError extends Error {
    constructor(
      public readonly mcpCode: number,
      public readonly httpStatus: number,
      message: string,
    ) {
      super(message);
      this.name = "McpAuthError";
    }
  }
  return { McpAuthError: MockMcpAuthError, validateBearerToken: vi.fn() };
});

import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { McpAuthError, validateBearerToken } from "@/lib/mcp/auth";
import { mcpAuthAttemptAllowed, recordMcpAuthFailure } from "@/lib/mcp/auth-rate-limit";
import { createMcpServer } from "@/lib/mcp/server";

function request() {
  return new NextRequest("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      authorization: "Bearer dsk_guess",
      "x-forwarded-for": "203.0.113.20",
    },
    body: "{}",
  });
}

describe("POST /api/mcp authentication throttling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createMcpServer).mockReturnValue({ connect: vi.fn() } as never);
    vi.mocked(mcpAuthAttemptAllowed).mockResolvedValue({
      allowed: true,
      count: 0,
      limit: 30,
      window_sec: 60,
    });
    vi.mocked(recordMcpAuthFailure).mockResolvedValue({
      allowed: true,
      count: 1,
      limit: 30,
      window_sec: 60,
    });
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      count: 1,
      limit: 120,
      window_sec: 60,
    });
  });

  it("rejects an exhausted IP bucket before querying api_tokens", async () => {
    vi.mocked(mcpAuthAttemptAllowed).mockResolvedValueOnce({
      allowed: false,
      count: 30,
      limit: 30,
      window_sec: 60,
    });
    const { POST } = await import("./route");

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("x-ratelimit-limit")).toBe("30");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(validateBearerToken).not.toHaveBeenCalled();
  });

  it("records a failed token attempt but never applies the org limit", async () => {
    vi.mocked(validateBearerToken).mockRejectedValueOnce(
      new McpAuthError(-32001, 401, "Token not recognized."),
    );
    const { POST } = await import("./route");

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(recordMcpAuthFailure).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("does not consume the failed-attempt budget for a valid token", async () => {
    vi.mocked(validateBearerToken).mockResolvedValueOnce({
      organizationId: "org-a",
      role: "agent",
      actor: { type: "user", id: "user-a", role: "agent" },
      apiTokenId: "token-a",
      scopes: ["mcp:read"],
    });
    const { POST } = await import("./route");

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(recordMcpAuthFailure).not.toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalledWith("mcp:org-a", 120, 60);
  });
});
