import { describe, expect, it } from "vitest";
import { InMemoryJobEngine, JobEngineError } from "./job-engine.js";
import type { PostgresJobClaimStore } from "./job-claim-store.js";
describe("Wave 1 Job Engine + Event Contracts", () => {
  it("executa queued -> claimed -> running -> completed -> evidence", () => {
    let tick = 0;
    const engine = new InMemoryJobEngine({ now: () => "2026-09-11T00:00:0" + tick++ + ".000Z", id: (() => { let n = 0; return () => "id-" + n++; })() });
    const queued = engine.enqueue({ organizationId: "org-a", kind: "sync", payload: { source: "test" } });
    expect(queued.status).toBe("queued"); engine.claim(queued.id, "worker-a", "org-a"); engine.start(queued.id, "worker-a", "org-a"); engine.complete(queued.id, "worker-a", "org-a");
    const result = engine.recordEvidence(queued.id, { kind: "test", ref: "run-1" }, "org-a");
    expect(result.job.status).toBe("evidence"); expect(result.job.evidence).toEqual([{ kind: "test", ref: "run-1" }]); expect(engine.listEvents("org-a").map((event) => event.type)).toEqual(["job.queued", "job.claimed", "job.running", "job.completed", "job.evidence"]);
  });
  it("impede transição inválida, worker alheio e tenant cruzado", () => {
    const engine = new InMemoryJobEngine({ id: () => "fixed" }); const job = engine.enqueue({ organizationId: "org-a", kind: "sync", payload: null });
    expect(() => engine.start(job.id, "worker-a", "org-a")).toThrowError(new JobEngineError("ownership_mismatch", "job_worker_mismatch")); engine.claim(job.id, "worker-a", "org-a"); expect(() => engine.start(job.id, "worker-b", "org-a")).toThrow("job_worker_mismatch"); expect(() => engine.getJob(job.id, "org-b")).toThrow("job_tenant_mismatch"); engine.start(job.id, "worker-a", "org-a"); expect(() => engine.recordEvidence(job.id, { kind: "test", ref: "early" }, "org-a")).toThrow("running_to_evidence_not_allowed");
  });
  it("usa claim persistido e rejeita o segundo worker", async () => {
    const engine = new InMemoryJobEngine({ id: () => "job-1" });
    const job = engine.enqueue({ organizationId: "org-a", kind: "sync", payload: null });
    let owner: string | null = null;
    const store = {
      claim: async (_org: string, _job: string, worker: string) => {
        if (owner) return undefined;
        owner = worker;
        return { id: "claim-1", organizationId: "org-a", jobId: job.id, workerId: worker, status: "CLAIMED", attempts: 1 };
      },
      release: async () => undefined,
    } as unknown as PostgresJobClaimStore;
    await engine.claimPersisted(job.id, "worker-a", "org-a", store);
    await expect(engine.claimPersisted(job.id, "worker-b", "org-a", store)).rejects.toThrow("job_already_claimed");
  });
  it("rejeita enqueue sem tenant ou tipo de job", () => {
    const engine = new InMemoryJobEngine({ id: () => "job-invalid" });
    expect(() => engine.enqueue({ organizationId: " ", kind: "sync", payload: null })).toThrow("job_input_invalid");
    expect(() => engine.enqueue({ organizationId: "org-a", kind: " ", payload: null })).toThrow("job_input_invalid");
  });
});
