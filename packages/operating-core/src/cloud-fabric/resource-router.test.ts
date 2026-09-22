import { describe, expect, it } from "vitest";
import type { ExecutionPort } from "./execution-port.js";
import { QuotaRouter } from "./quota-router.js";
import { ResourceRouter } from "./resource-router.js";

function provider(name: string, input: { healthy?: boolean; capabilities?: string[]; remaining?: number; available?: boolean } = {}): ExecutionPort {
  const healthy = input.healthy ?? true;
  return {
    name,
    execute: async () => { throw new Error("not used"); },
    resume: async () => { throw new Error("not used"); },
    cancel: async () => { throw new Error("not used"); },
    health: async () => ({ ok: healthy, status: healthy ? "healthy" : "unavailable" }),
    capabilities: async () => input.capabilities ?? ["execute", "read_only"],
    usage: async () => ({ input_tokens: 0, cached_tokens: 0, output_tokens: 0, duration_ms: 0, cost_usd: 0 }),
    quota: async () => ({ provider: name, tokens_used: 0, cost_usd: 0, remaining_budget: input.remaining, available: input.available ?? true }),
    checkQuota: async () => ({ provider: name, tokens_used: 0, cost_usd: 0, remaining_budget: input.remaining, available: input.available ?? true }),
  };
}

describe("ResourceRouter V2", () => {
  it("selects only healthy providers with required capabilities and verified quota", async () => {
    const router = new QuotaRouter();
    const unavailable = provider("unavailable", { available: false, remaining: undefined });
    const missingCapability = provider("missing", { capabilities: ["execute"], remaining: 100 });
    const selected = provider("selected", { capabilities: ["execute", "read_only"], remaining: 100 });

    await expect(router.selectProviderBasedOnQuota([unavailable, missingCapability, selected], ["read_only"])).resolves.toBe(selected);
  });

  it("does not select an unhealthy provider even when quota is positive", async () => {
    const router = new QuotaRouter();

    await expect(router.selectProviderBasedOnQuota([provider("bad", { healthy: false, remaining: 100 })])).rejects.toThrow("No healthy providers");
  });

  it("keeps the default router from treating unavailable adapters as executable", async () => {
    const target = await new ResourceRouter().route({ capability: ["read_only"], priority: 1 });

    expect(target.adapter).toBeUndefined();
    expect(target.provider).toBe("OPENAI_CLOUD");
    expect(target.reason).toBe("no_healthy_provider_with_verified_quota");
  });
});
