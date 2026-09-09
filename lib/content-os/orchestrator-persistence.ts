import type { EditorialRun, EditorialRunStatus } from "./orchestrator";

/** Narrow adapter keeps the orchestrator independent of Supabase's generated schema. */
export type EditorialPersistenceDb = {
  from(table: "content_research_runs"): {
    insert(values: Record<string, unknown>): { select(): { single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } };
    select(columns?: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
          order(column: string, options: { ascending: boolean }): { limit(value: number): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> };
        };
        order(column: string, options: { ascending: boolean }): { limit(value: number): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> };
      };
    };
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): { eq(column: string, value: string): { select(): { single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } } };
    };
  };
  persistArtifacts?(run: EditorialRun): Promise<void>;
};

function asRun(row: Record<string, unknown>): EditorialRun {
  const result = row.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Persisted editorial run is invalid");
  const run = result as Partial<EditorialRun>;
  if (typeof run.id !== "string" || typeof run.organizationId !== "string" || typeof run.topic !== "string") {
    throw new Error("Persisted editorial run is missing identity");
  }
  return run as EditorialRun;
}

function dbStatus(status: EditorialRunStatus): "queued" | "running" | "succeeded" | "failed" | "cancelled" {
  if (status === "queued") return "queued";
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "blocked") return "failed";
  return "running";
}

function persistenceTimestamps(run: EditorialRun): { started_at: string | null; completed_at: string | null } {
  const started = run.status === "queued" ? null : run.createdAt;
  const completed = ["succeeded", "failed", "blocked"].includes(run.status) ? run.updatedAt : null;
  return { started_at: started, completed_at: completed };
}

export async function saveEditorialRun(db: EditorialPersistenceDb, run: EditorialRun): Promise<EditorialRun> {
  const result = JSON.parse(JSON.stringify(run)) as Record<string, unknown>;
  const timestamps = persistenceTimestamps(run);
  const query = db.from("content_research_runs");
  const existing = await query.select("id").eq("organization_id", run.organizationId).eq("id", run.id).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    const updated = await query.update({ status: dbStatus(run.status), result, query: run.topic, error_code: run.errors.at(-1)?.code ?? null, ...timestamps }).eq("organization_id", run.organizationId).eq("id", run.id).select().single();
    if (updated.error || !updated.data) throw new Error(updated.error?.message ?? "Editorial run update failed");
    await db.persistArtifacts?.(run);
    return run;
  }
  const inserted = await query.insert({
    id: run.id,
    organization_id: run.organizationId,
    provider: "content-os-editorial",
    query: run.topic,
    idempotency_key: `editorial:${run.id}`,
    status: dbStatus(run.status),
    attempt_count: Object.values(run.attempts).reduce((sum, count) => sum + (count ?? 0), 0),
    result,
    error_code: run.errors.at(-1)?.code ?? null,
    ...timestamps,
  }).select().single();
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Editorial run insert failed");
  await db.persistArtifacts?.(run);
  return run;
}

export async function loadEditorialRun(db: EditorialPersistenceDb, organizationId: string, id: string): Promise<EditorialRun | null> {
  const result = await db.from("content_research_runs").select("id,result").eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data ? asRun(result.data) : null;
}

export async function listEditorialRuns(db: EditorialPersistenceDb, limit = 100): Promise<EditorialRun[]> {
  const result = await db.from("content_research_runs").select("id,result").eq("provider", "content-os-editorial").order("updated_at", { ascending: false }).limit(limit);
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []).map(asRun);
}
