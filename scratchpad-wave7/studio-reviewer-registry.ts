export type ReviewerRegistryQueryable = { query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }> };

export type ReviewerRecord = {
  organizationId: string;
  reviewerId: string;
  role: "owner" | "manager" | "reviewer";
  active?: boolean;
};

type ReviewerRow = { organization_id: string; reviewer_id: string; role: ReviewerRecord["role"]; active: boolean };

export async function ensureReviewerRegistry(db: ReviewerRegistryQueryable): Promise<void> {
  await db.query("SELECT to_regclass('public.studio_reviewer_authorizations') AS table_name");
}

export async function registerReviewer(db: ReviewerRegistryQueryable, reviewer: ReviewerRecord): Promise<void> {
  if (!reviewer.organizationId.trim() || !reviewer.reviewerId.trim()) throw new Error("reviewer_invalid");
  await db.query(
    `INSERT INTO public.studio_reviewer_authorizations (organization_id, reviewer_id, role, active)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (organization_id, reviewer_id) DO UPDATE SET role=EXCLUDED.role, active=EXCLUDED.active`,
    [reviewer.organizationId, reviewer.reviewerId, reviewer.role, reviewer.active ?? true],
  );
}

export async function assertAuthorizedReviewer(db: ReviewerRegistryQueryable, organizationId: string, reviewerId: string): Promise<void> {
  if (!organizationId.trim() || !reviewerId.trim()) throw new Error("reviewer_not_authorized");
  const result = await db.query<ReviewerRow>(
    `SELECT organization_id, reviewer_id, role, active
       FROM public.studio_reviewer_authorizations
      WHERE organization_id=$1 AND reviewer_id=$2 AND active=true`,
    [organizationId, reviewerId],
  );
  if (!result.rows[0]) throw new Error("reviewer_not_authorized");
}
