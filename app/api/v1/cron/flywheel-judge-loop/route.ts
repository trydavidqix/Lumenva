/**
 * Phase 10 Flywheel: daily judge/distiller scheduler
 *
 * Runs once per day at 02:00 UTC.
 * Triggers flywheel judge loop for all organizations with active agents.
 *
 * Job flow:
 * 1. List all organizations
 * 2. For each org: call runFlywheelOnce() from lib/agent-engine/flywheel/live.ts
 * 3. Persist outcomes via lib/agent-engine/flywheel/outcome-collector.ts
 * 4. Log results to api_audit_log (event: ai.flywheel_run)
 * 5. Alert on Sentry if latency >5min or errors >10% of orgs
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInternalSecret } from "@/lib/internal-secret";
import { runFlywheelOnce } from "@/lib/agent-engine/flywheel/live";
import { persistFollowupOutcomes } from "@/lib/agent-engine/flywheel/outcome-collector";
import { logAudit } from "@/lib/audit/client";

export const runtime = "nodejs";
export const maxDuration = 600; // 10 min timeout

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  // Auth via INTERNAL_SECRET (shared with all crons)
  const secret = request.headers.get("x-internal-secret");
  if (secret !== getInternalSecret()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json(
        { error: "Failed to list organizations" },
        { status: 500 },
      );
    }

    const results = {
      total_orgs: orgs.length,
      successful_runs: 0,
      failed_runs: 0,
      skipped_runs: 0,
      total_proposals: 0,
      total_outcomes: 0,
      errors: [] as string[],
    };

    // Run flywheel for each org
    for (const org of orgs) {
      try {
        const orgId = org.id;

        console.log(`[flywheel-cron] starting run for org ${orgId}`);

        // Call judge/distiller
        const result = await runFlywheelOnce(orgId);

        if (!result) {
          results.skipped_runs++;
          console.log(`[flywheel-cron] skipped org ${orgId} (no recent turns)`);
          continue;
        }

        results.successful_runs++;
        results.total_proposals += result.proposals?.length || 0;

        // Persist outcomes
        const outcomes = await persistFollowupOutcomes(
          orgId,
          result.run_id,
          new Date(),
        );

        if (outcomes) {
          const total = Object.values(outcomes.outcomes).reduce(
            (a, b) => a + b,
            0,
          );
          results.total_outcomes += total;
        }

        // Audit log
        await logAudit({
          action: "ai.flywheel_run",
          actor_id: "system:flywheel-cron",
          resource_type: "ai_agent",
          resource_id: `org:${orgId}`,
          organization_id: orgId,
          metadata: {
            run_id: result.run_id,
            proposals_count: result.proposals?.length || 0,
            outcomes: outcomes?.outcomes,
          },
        }).catch((err) => {
          console.error(`[flywheel-cron] audit log failed: ${err.message}`);
        });
      } catch (error) {
        results.failed_runs++;
        const msg = error instanceof Error ? error.message : String(error);
        results.errors.push(`org ${org.id}: ${msg}`);
        console.error(
          `[flywheel-cron] error running flywheel for org ${org.id}: ${msg}`,
        );
      }
    }

    const duration = Date.now() - startTime;

    const summary = {
      status: results.failed_runs > results.total_orgs * 0.1 ? "warning" : "ok",
      duration_ms: duration,
      ...results,
    };

    console.log(
      `[flywheel-cron] completed: ${JSON.stringify(summary)}`,
    );

    return NextResponse.json(summary);
  } catch (error) {
    console.error(
      `[flywheel-cron] fatal error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return NextResponse.json(
      { error: "Flywheel loop failed" },
      { status: 500 },
    );
  }
}
