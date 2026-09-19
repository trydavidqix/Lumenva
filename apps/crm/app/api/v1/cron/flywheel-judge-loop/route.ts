/**
 * Phase 10 Flywheel: daily judge/distiller scheduler (placeholder)
 *
 * Runs once per day at 02:00 UTC (Inngest schedule).
 * Currently placeholder — routes to judge endpoint.
 *
 * TODO (Task 2 future work):
 * 1. Wire Inngest function: orchestrate judge per org
 * 2. Call runFlywheelOnce(pool, llmCfg, opts) with Postgres connection
 * 3. Persist outcomes via outcome-collector
 * 4. Audit logging
 *
 * Current MVP:
 * - Lists orgs
 * - Persists outcomes (assumes judge runs elsewhere)
 * - Returns summary
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { persistFollowupOutcomes } from "@/lib/agent-engine/flywheel/outcome-collector";
import { fail, ok } from "@/lib/api/wrappers";

export const runtime = "nodejs";
// Teto do plano Hobby da Vercel é 300s (2026-08-22: todo deploy production
// falhava com errorCode "invalid_max_duration" nesta função — build passava,
// deploy morria no passo patchBuild). Se o cron precisar de mais que 5min,
// a correção é fazer upgrade do plano, não subir este número de novo.
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<Response> {
  const startTime = Date.now();

  // Auth via INTERNAL_SECRET (shared with all crons)
  const secret = request.headers.get("x-internal-secret");
  if (secret !== env.INTERNAL_SECRET) {
    return fail("unauthorized", "Unauthorized", 401);
  }

  const admin = createAdminClient();

  try {
    // List all organizations
    const { data: orgs, error: orgsError } = await admin
      .from("organizations")
      .select("id")
      .eq("is_deleted", false);

    if (orgsError || !orgs) {
      console.error(`[flywheel-cron] error listing orgs: ${orgsError?.message}`);
      return fail("internal_error", "Failed to list organizations", 500);
    }

    const results = {
      total_orgs: orgs.length,
      successful_runs: 0,
      failed_runs: 0,
      skipped_runs: 0,
      total_outcomes: 0,
      errors: [] as string[],
    };

    // For MVP: persist outcomes assuming judge runs separately
    // (Full implementation wires Inngest + runFlywheelOnce)
    for (const org of orgs) {
      try {
        const orgId = org.id;
        console.log(`[flywheel-cron] checking org ${orgId}`);

        // Query latest judge verdicts to find run_id
        const { data: verdicts, error: verdictError } = await admin
          .from("flywheel_judge_verdicts")
          .select("run_id")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (verdictError) {
          console.warn(`[flywheel-cron] no judge verdicts for org ${orgId}`);
          results.skipped_runs++;
          continue;
        }

        if (!verdicts || verdicts.length === 0) {
          results.skipped_runs++;
          console.log(`[flywheel-cron] skipped org ${orgId} (no verdicts)`);
          continue;
        }

        const runId = verdicts[0]?.run_id;

        // Persist outcomes
        const outcomes = await persistFollowupOutcomes(orgId, runId, new Date());

        if (outcomes) {
          const total = Object.values(outcomes.outcomes).reduce(
            (a: number, b: number) => a + b,
            0,
          );
          results.total_outcomes += total;
          results.successful_runs++;
          console.log(`[flywheel-cron] persisted outcomes for org ${orgId}: ${total} total`);
        } else {
          results.skipped_runs++;
        }
      } catch (error) {
        results.failed_runs++;
        const msg = error instanceof Error ? error.message : String(error);
        results.errors.push(`org ${org.id}: ${msg}`);
        console.error(`[flywheel-cron] error for org ${org.id}: ${msg}`);
      }
    }

    const duration = Date.now() - startTime;

    const summary = {
      status: results.failed_runs > results.total_orgs * 0.1 ? "warning" : "ok",
      duration_ms: duration,
      ...results,
    };

    console.log(`[flywheel-cron] completed: ${JSON.stringify(summary)}`);
    return ok(summary);
  } catch (error) {
    console.error(
      `[flywheel-cron] fatal error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return fail("internal_error", "Flywheel loop failed", 500);
  }
}
