import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit, peekRateLimit } from "@/lib/ai/dispatcher/rate-limit";

vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  peekRateLimit: vi.fn(),
}));

function request(headers: Record<string, string> = {}): Pick<Request, "headers"> {
  return { headers: new Headers(headers) };
}

describe("MCP auth rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(peekRateLimit).mockResolvedValue(0);
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      count: 1,
      limit: 30,
      window_sec: 60,
    });
  });

  it("checks the opaque client-IP bucket before token lookup", async () => {
    const { mcpAuthAttemptAllowed } = await import("./auth-rate-limit");
    const ip = "203.0.113.7";
    const bucket = `mcp:auth:ip:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;

    const result = await mcpAuthAttemptAllowed(request({ "x-forwarded-for": `${ip}, 10.0.0.1` }));

    expect(result.allowed).toBe(true);
    expect(peekRateLimit).toHaveBeenCalledWith(bucket, 60);
  });

  it("blocks before token lookup when the failed-attempt bucket is exhausted", async () => {
    vi.mocked(peekRateLimit).mockResolvedValue(30);
    const { mcpAuthAttemptAllowed } = await import("./auth-rate-limit");

    const result = await mcpAuthAttemptAllowed(request({ "x-real-ip": "203.0.113.8" }));

    expect(result).toEqual({ allowed: false, count: 30, limit: 30, window_sec: 60 });
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("records only the failed authentication attempt in the same opaque bucket", async () => {
    const { recordMcpAuthFailure } = await import("./auth-rate-limit");
    const ip = "203.0.113.9";
    const bucket = `mcp:auth:ip:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;

    await recordMcpAuthFailure(request({ "x-real-ip": ip }));

    expect(checkRateLimit).toHaveBeenCalledWith(bucket, 30, 60);
  });

  it("does not create a shared global bucket when the runtime exposes no client IP", async () => {
    const { mcpAuthAttemptAllowed, recordMcpAuthFailure } = await import("./auth-rate-limit");

    expect((await mcpAuthAttemptAllowed(request())).allowed).toBe(true);
    await recordMcpAuthFailure(request());

    expect(peekRateLimit).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });
});
