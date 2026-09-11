export const JOB_STATUSES = ["queued", "claimed", "running", "completed", "evidence"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export interface Evidence { kind: string; ref: string; metadata?: Readonly<Record<string, unknown>>; }
export interface Job<TPayload = unknown> { id: string; organizationId: string; kind: string; payload: TPayload; status: JobStatus; claimedBy: string | null; attempts: number; evidence: readonly Evidence[]; createdAt: string; updatedAt: string; }
export const JOB_EVENT_TYPES = ["job.queued", "job.claimed", "job.running", "job.completed", "job.evidence"] as const;
export type JobEventType = (typeof JOB_EVENT_TYPES)[number];
export interface JobEvent<TPayload = unknown> { id: string; organizationId: string; jobId: string; type: JobEventType; occurredAt: string; payload: TPayload; metadata: Readonly<Record<string, unknown>>; }
export interface JobEvidence { job: Job; event: JobEvent; }
