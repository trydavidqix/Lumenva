export type Queryable = { query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }> };
export type JobClaimStatus = "CLAIMED" | "RELEASED";
export type JobClaim = {
  id: string;
  organizationId: string;
  jobId: string;
  workerId: string;
  status: JobClaimStatus;
  attempts: number;
  claimedAt?: string;
  releasedAt?: string | null;
};

type StoredJobClaim = JobClaim;

export class PostgresJobClaimStore {
  constructor(private readonly db: Queryable) {}

  /** Atomically claims a job. Empty RETURNING means another worker owns it. */
  async claim(organizationId: string, jobId: string, workerId: string): Promise<JobClaim | undefined> {
    try {
      const result = await this.db.query<StoredJobClaim>(
        `insert into public.operating_core_job_claims (organization_id,job_id,worker_id,status,attempts,claimed_at,released_at) values ($1,$2,$3,'CLAIMED',1,now(),null) on conflict (organization_id,job_id) do update set worker_id=excluded.worker_id,status='CLAIMED',attempts=operating_core_job_claims.attempts+1,claimed_at=now(),released_at=null,updated_at=now() where operating_core_job_claims.status='RELEASED' returning id,organization_id as "organizationId",job_id as "jobId",worker_id as "workerId",status,attempts,claimed_at as "claimedAt",released_at as "releasedAt"`,
        [organizationId, jobId, workerId],
      );
      return result.rows[0];
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return undefined;
      throw error;
    }
  }

  async release(organizationId: string, jobId: string, workerId: string): Promise<JobClaim | undefined> {
    const result = await this.db.query<StoredJobClaim>(
      `update public.operating_core_job_claims set status='RELEASED',released_at=now(),updated_at=now() where organization_id=$1 and job_id=$2 and worker_id=$3 and status='CLAIMED' returning id,organization_id as "organizationId",job_id as "jobId",worker_id as "workerId",status,attempts,claimed_at as "claimedAt",released_at as "releasedAt"`,
      [organizationId, jobId, workerId],
    );
    return result.rows[0];
  }

  async get(organizationId: string, jobId: string): Promise<JobClaim | undefined> {
    const result = await this.db.query<StoredJobClaim>(
      `select id,organization_id as "organizationId",job_id as "jobId",worker_id as "workerId",status,attempts,claimed_at as "claimedAt",released_at as "releasedAt" from public.operating_core_job_claims where organization_id=$1 and job_id=$2`,
      [organizationId, jobId],
    );
    return result.rows[0];
  }
}
