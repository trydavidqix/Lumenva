import type { CreativeProvider } from "@/lib/content-os/providers/creative";
import type { ProviderJobState } from "@/lib/content-os/providers/types";
import { applyCreativeProviderResult, type CreativeJob, type CreativeJobDb } from "@/lib/content-os/creative/job-service";

export async function processCreativeJob(db: CreativeJobDb, provider: CreativeProvider, job: CreativeJob): Promise<CreativeJob> {
  if (["succeeded", "failed", "cancelled"].includes(job.state)) return job;
  if (job.cancel_requested_at) {
    if (job.provider_job_id) await provider.cancel(job.provider_job_id);
    return applyCreativeProviderResult(db, job, { state: "cancelled", providerJobId: job.provider_job_id });
  }
  try {
    if (!job.provider_job_id) {
      const ref = await provider.generate({ organizationId: job.organization_id, idempotencyKey: job.idempotency_key, workflow: job.operation, parameters: job.parameters });
      return applyCreativeProviderResult(db, job, { state: ref.state, providerJobId: ref.providerJobId });
    }
    const ref = await provider.status(job.provider_job_id);
    return applyCreativeProviderResult(db, job, { state: ref.state, providerJobId: ref.providerJobId });
  } catch (error) {
    const code = error instanceof Error ? error.name : "provider_error";
    return applyCreativeProviderResult(db, job, { state: "failed", providerJobId: job.provider_job_id, errorCode: code });
  }
}

export function isTerminalCreativeState(state: ProviderJobState): boolean { return ["succeeded", "failed", "cancelled"].includes(state); }
