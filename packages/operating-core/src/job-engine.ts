import { JOB_EVENT_TYPES, type Evidence, type Job, type JobEvent, type JobEventType, type JobEvidence } from "./contracts.js";
import type { PostgresJobClaimStore } from "./job-claim-store.js";
const transitions: Record<Job["status"], readonly Job["status"][]> = { queued: ["claimed"], claimed: ["running", "queued"], running: ["completed", "queued"], completed: ["evidence"], evidence: [] };
export class JobEngineError extends Error { constructor(readonly code: "not_found" | "invalid_transition" | "tenant_mismatch" | "ownership_mismatch" | "claim_conflict", message: string) { super(message); this.name = "JobEngineError"; } }
export interface JobEngineOptions { now?: () => string; id?: () => string; }
export class InMemoryJobEngine {
  private readonly jobs = new Map<string, Job>(); private readonly events: JobEvent[] = []; private readonly now: () => string; private readonly id: () => string;
  constructor(options: JobEngineOptions = {}) { this.now = options.now ?? (() => new Date().toISOString()); this.id = options.id ?? (() => crypto.randomUUID()); }
  enqueue<T>(input: { id?: string; organizationId: string; kind: string; payload: T }): Job<T> { const timestamp = this.now(); const job: Job<T> = { id: input.id ?? this.id(), organizationId: input.organizationId, kind: input.kind, payload: input.payload, status: "queued", claimedBy: null, attempts: 0, evidence: [], createdAt: timestamp, updatedAt: timestamp }; this.jobs.set(job.id, job); this.emit(job, "job.queued", { kind: job.kind }); return job; }
  claim(id: string, workerId: string, organizationId: string): Job { const job = this.get(id, organizationId); this.transition(job, "claimed"); job.claimedBy = workerId; job.attempts += 1; this.touch(job); this.emit(job, "job.claimed", { workerId }); return job; }
  async claimPersisted(id: string, workerId: string, organizationId: string, claimStore: Pick<PostgresJobClaimStore, "claim" | "release">): Promise<Job> {
    const claim = await claimStore.claim(organizationId, id, workerId);
    if (!claim) throw new JobEngineError("claim_conflict", "job_already_claimed");
    try {
      return this.claim(id, workerId, organizationId);
    } catch (error) {
      await claimStore.release(organizationId, id, workerId);
      throw error;
    }
  }
  start(id: string, workerId: string, organizationId: string): Job { const job = this.getOwned(id, workerId, organizationId); this.transition(job, "running"); this.touch(job); this.emit(job, "job.running", { workerId }); return job; }
  complete(id: string, workerId: string, organizationId: string): Job { const job = this.getOwned(id, workerId, organizationId); this.transition(job, "completed"); this.touch(job); this.emit(job, "job.completed", { workerId }); return job; }
  recordEvidence(id: string, evidence: Evidence, organizationId: string): JobEvidence { const job = this.get(id, organizationId); this.transition(job, "evidence"); job.evidence = [...job.evidence, evidence]; this.touch(job); const event = this.emit(job, "job.evidence", evidence); return { job, event }; }
  getJob(id: string, organizationId: string): Job { return this.get(id, organizationId); }
  listEvents(organizationId: string): readonly JobEvent[] { return this.events.filter((event) => event.organizationId === organizationId); }
  private get(id: string, organizationId: string): Job { const job = this.jobs.get(id); if (!job) throw new JobEngineError("not_found", "job_not_found"); if (job.organizationId !== organizationId) throw new JobEngineError("tenant_mismatch", "job_tenant_mismatch"); return job; }
  private getOwned(id: string, workerId: string, organizationId: string): Job { const job = this.get(id, organizationId); if (job.claimedBy !== workerId) throw new JobEngineError("ownership_mismatch", "job_worker_mismatch"); return job; }
  private transition(job: Job, next: Job["status"]): void { if (!transitions[job.status].includes(next)) throw new JobEngineError("invalid_transition", job.status + "_to_" + next + "_not_allowed"); job.status = next; }
  private touch(job: Job): void { job.updatedAt = this.now(); }
  private emit(job: Job, type: JobEventType, payload: unknown): JobEvent { if (!JOB_EVENT_TYPES.includes(type)) throw new JobEngineError("invalid_transition", "unknown_job_event"); const event: JobEvent = { id: this.id(), organizationId: job.organizationId, jobId: job.id, type, occurredAt: this.now(), payload, metadata: { attempts: job.attempts } }; this.events.push(event); return event; }
}
