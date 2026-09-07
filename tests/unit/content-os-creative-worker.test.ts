import { describe, expect, it, vi } from "vitest";
import { processCreativeJob } from "@/workers/content-os-creative-worker/main";

const job = { id: "job-1", organization_id: "org-1", content_item_id: null, provider: "test", operation: "hero", request_hash: "x", idempotency_key: "k", provider_job_id: null, state: "queued" as const, parameters: {}, attempts: 0, last_error_code: null, last_error_at: null, started_at: null, completed_at: null, cancel_requested_at: null };
function db() { const query = { select: () => query, insert: () => query, update: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: { ...job, state: "running", provider_job_id: "p-1" }, error: null }) }; return { from: () => query }; }

describe("Content OS creative worker", () => {
  it("submits provider work only after local queued job exists", async () => {
    const provider = { provider: "test", generate: vi.fn(async () => ({ provider: "test", providerJobId: "p-1", state: "running" as const })), status: vi.fn(), cancel: vi.fn(), health: vi.fn() };
    const result = await processCreativeJob(db() as never, provider, job);
    expect(provider.generate).toHaveBeenCalledOnce(); expect(result.provider_job_id).toBe("p-1");
  });
});
