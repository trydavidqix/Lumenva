/**
 * Phase 10 Flywheel: outcome collector
 *
 * After a flywheel judge run, collect follow-up enrollment outcomes
 * and persist them to flywheel_followup_outcomes table.
 *
 * This closes the loop: judge → distiller → apply proposal → outcomes → next judge run.
 */

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { HermesOutcomeStore } from "@/lib/agent-engine/hermes/outcome-ledger";

export interface FlywheelOutcomeStats {
  run_id: string;
  organization_id: string;
  outcomes: Record<string, number>;
  recorded_at: string;
  hermes_mirror?: {
    attempted: number;
    mirrored: number;
    errors: string[];
  };
}

export interface FollowupOutcomeMirrorOptions {
  store: HermesOutcomeStore;
  idFactory?: () => string;
}

function safeMirrorError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 240);
}

/**
 * Mirrors the already-persisted legacy aggregate into the generic Hermes ledger.
 * This is deliberately best-effort: the legacy Phase 10 write is authoritative for
 * compatibility and MUST NOT be rolled back if the additive Hermes mirror fails.
 */
export async function mirrorFollowupOutcomesToHermes(
  stats: Omit<FlywheelOutcomeStats, "hermes_mirror">,
  options: FollowupOutcomeMirrorOptions,
): Promise<NonNullable<FlywheelOutcomeStats["hermes_mirror"]>> {
  const idFactory = options.idFactory ?? randomUUID;
  const entries = Object.entries(stats.outcomes);
  const errors: string[] = [];
  let mirrored = 0;

  for (const [outcome, count] of entries) {
    try {
      await options.store.append({
        id: idFactory(),
        organizationId: stats.organization_id,
        runId: stats.run_id,
        missionId: null,
        candidateId: null,
        subjectKind: "followup_outcome",
        subjectId: outcome,
        technicalQuality: null,
        costCents: null,
        latencyMs: null,
        kpiName: "followup_count",
        kpiBaseline: null,
        kpiObserved: count,
        evidenceRefs: [`flywheel_followup_outcome:${stats.run_id}:${outcome}`],
        observedAt: stats.recorded_at,
      });
      mirrored += 1;
    } catch (error) {
      errors.push(`${outcome}:${safeMirrorError(error)}`);
    }
  }

  return { attempted: entries.length, mirrored, errors };
}

/**
 * Aggregate follow-up enrollment outcomes for a flywheel run and persist.
 *
 * Queries followup_enrollments created during [run_start, run_end] window,
 * groups by outcome type, and inserts summary rows into flywheel_followup_outcomes.
 *
 * Called by flywheel-judge-loop.ts after judge/distiller completes.
 */
export async function persistFollowupOutcomes(
  organizationId: string,
  runId: string,
  runEndedAt: Date,
  options?: { hermesMirror?: FollowupOutcomeMirrorOptions },
): Promise<FlywheelOutcomeStats | null> {
  const admin = createAdminClient();

  // Query followup_enrollments for outcomes created since run start
  // (assume run took ~30min from start to completion)
  const runStartedAt = new Date(runEndedAt.getTime() - 30 * 60 * 1000);

  const { data: enrollments, error: enrollError } = await admin
    .from("followup_enrollments")
    .select("outcome")
    .eq("organization_id", organizationId)
    .gte("created_at", runStartedAt.toISOString())
    .lte("created_at", runEndedAt.toISOString());

  if (enrollError) {
    console.error(
      `[flywheel] error fetching outcomes: ${enrollError.message}`,
    );
    return null;
  }

  if (!enrollments || enrollments.length === 0) {
    console.log(`[flywheel] no enrollments found for run ${runId}`);
    return null;
  }

  // Aggregate by outcome type
  const outcomes: Record<string, number> = {};
  for (const enrollment of enrollments) {
    const outcome = enrollment.outcome || "in_flight";
    outcomes[outcome] = (outcomes[outcome] || 0) + 1;
  }

  // Persist to flywheel_followup_outcomes first. This remains the compatibility
  // write and must succeed before any generic Hermes mirror is attempted.
  const recordedAt = new Date();
  const rows = Object.entries(outcomes).map(([outcome, count]) => ({
    organization_id: organizationId,
    run_id: runId,
    outcome,
    count,
    recorded_at: recordedAt.toISOString(),
  }));

  const { error: insertError } = await admin
    .from("flywheel_followup_outcomes")
    .insert(rows);

  if (insertError) {
    console.error(
      `[flywheel] error persisting outcomes: ${insertError.message}`,
    );
    return null;
  }

  const baseStats: Omit<FlywheelOutcomeStats, "hermes_mirror"> = {
    run_id: runId,
    organization_id: organizationId,
    outcomes,
    recorded_at: recordedAt.toISOString(),
  };

  let hermesMirror: FlywheelOutcomeStats["hermes_mirror"];
  if (options?.hermesMirror) {
    hermesMirror = await mirrorFollowupOutcomesToHermes(baseStats, options.hermesMirror);
    if (hermesMirror.errors.length > 0) {
      console.warn("[flywheel] Hermes outcome mirror partially failed", {
        organizationId,
        runId,
        attempted: hermesMirror.attempted,
        mirrored: hermesMirror.mirrored,
        errors: hermesMirror.errors,
      });
    }
  }

  console.log(
    `[flywheel] persisted outcomes for run ${runId}: ${JSON.stringify(outcomes)}`,
  );

  return hermesMirror ? { ...baseStats, hermes_mirror: hermesMirror } : baseStats;
}

/**
 * Query aggregated outcomes for a flywheel run (UI dashboard).
 */
export async function getRunOutcomes(
  organizationId: string,
  runId: string,
): Promise<FlywheelOutcomeStats | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("flywheel_followup_outcomes")
    .select("outcome, count, recorded_at")
    .eq("organization_id", organizationId)
    .eq("run_id", runId);

  if (error) {
    console.error(
      `[flywheel] error querying outcomes: ${error.message}`,
    );
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const outcomes: Record<string, number> = {};
  let recordedAt = "";

  for (const row of data) {
    outcomes[row.outcome] = row.count || 0;
    recordedAt = row.recorded_at || "";
  }

  return {
    run_id: runId,
    organization_id: organizationId,
    outcomes,
    recorded_at: recordedAt,
  };
}

/**
 * Conversion rate for a flywheel run.
 * = converted / (converted + replied + exhausted + opted_out + handoff)
 */
export function getConversionRate(outcomes: Record<string, number>): number {
  const converted = outcomes.converted || 0;
  const total =
    (outcomes.converted || 0) +
    (outcomes.replied || 0) +
    (outcomes.exhausted || 0) +
    (outcomes.opted_out || 0) +
    (outcomes.handoff || 0);

  return total > 0 ? converted / total : 0;
}
