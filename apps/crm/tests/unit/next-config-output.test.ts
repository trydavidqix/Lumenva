import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  withSentryConfig: (config: unknown) => config,
}));

async function loadNextConfig(vercel?: string) {
  vi.resetModules();

  if (vercel) {
    vi.stubEnv("VERCEL", vercel);
  } else {
    vi.stubEnv("VERCEL", "");
  }

  return (await import("../../next.config")).default;
}

describe("next.config output", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses standalone output outside Vercel for Docker deployments", async () => {
    const config = await loadNextConfig();

    expect(config.output).toBe("standalone");
  });

  it("does not enable standalone output on Vercel", async () => {
    const config = await loadNextConfig("1");

    expect(config.output).toBeUndefined();
  });
});
