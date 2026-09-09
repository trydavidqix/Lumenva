/**
 * Phase 10 Flywheel: outcome collector
 *
 * After a flywheel judge run, collect follow-up enrollment outcomes
 * and persist them to flywheel_followup_outcomes table.
 *
 * This closes the loop: judge → distiller → apply proposal → outcomes → next judge run.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface FlywheelOutcomeStats {
  run_id: string;
  organization_id: string;
  outcomes: Record<string, number>;
  recorded_at: string;
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

  // Persist to flywheel_followup_outcomes
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

  console.log(
    `[flywheel] persisted outcomes for run ${runId}: ${JSON.stringify(outcomes)}`,
  );

  return {
    run_id: runId,
    organization_id: organizationId,
    outcomes,
    recorded_at: recordedAt.toISOString(),
  };
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
