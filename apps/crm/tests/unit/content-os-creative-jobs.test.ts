import { describe, expect, it } from "vitest";

import { createCreativeJob, CreativeJobIdempotencyConflict } from "@/lib/content-os/creative/job-service";

function dbWith(rows: Record<string, unknown>[]) {
  return { from: (table: string) => {
    const state: Record<string, unknown> = {};
    const query = { select: () => query, insert: (row: Record<string, unknown>) => { Object.assign(state, { ...row, id: "job-1", request_hash: "" }); return query; }, update: () => query, eq: (_key: string, value: unknown) => { state.value = value; return query; }, maybeSingle: async () => ({ data: rows[0] ?? null, error: null }), single: async () => ({ data: { ...state, state: "queued", parameters: {} }, error: null }) };
    return query;
  } };
}

describe("Content OS creative jobs", () => {
  it("creates a queued job with tenant-scoped idempotency", async () => {
    const result = await createCreativeJob(dbWith([]) as never, { organizationId: "org-1", provider: "comfy", operation: "hero", idempotencyKey: "key-1", parameters: { prompt: "x" } });
    expect(result.reused).toBe(false); expect(result.job.state).toBe("queued");
  });

  it("rejects reuse with a different request hash", async () => {
    const existing = { id: "job-1", organization_id: "org-1", request_hash: "different", state: "queued", parameters: {} };
    await expect(createCreativeJob(dbWith([existing]) as never, { organizationId: "org-1", provider: "comfy", operation: "hero", idempotencyKey: "key-1", parameters: {} })).rejects.toBeInstanceOf(CreativeJobIdempotencyConflict);
  });
});
