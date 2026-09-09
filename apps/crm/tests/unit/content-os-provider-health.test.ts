import { describe, expect, it } from "vitest";

import { checkProviderHealth } from "@/lib/content-os/providers/health";

describe("Content OS provider health", () => {
  it("normalizes a successful provider check", async () => {
    const health = await checkProviderHealth(async () => undefined, {
      timeoutMs: 50,
    });

    expect(health.ok).toBe(true);
    expect(health.code).toBe("ok");
    expect(health.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("reports a timeout with a stable safe result", async () => {
    const health = await checkProviderHealth(
      () => new Promise<void>(() => undefined),
      { timeoutMs: 1 },
    );

    expect(health).toMatchObject({
      ok: false,
      code: "timeout",
      message: "Provider health check timed out",
    });
  });

  it("does not expose raw provider error messages", async () => {
    const health = await checkProviderHealth(async () => {
      throw new Error("Authorization: Bearer secret-token");
    });

    expect(health).toMatchObject({
      ok: false,
      code: "unavailable",
      message: "Provider health check failed",
    });
    expect(JSON.stringify(health)).not.toContain("secret-token");
  });
});
