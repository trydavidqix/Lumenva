/**
 * GET /api/v1/cron/lgpd-sla-watcher
 *
 * Daily cron (09:00 WET / 09:00-10:00 UTC depending on DST) — scans active
 * lgpd_requests and fires an alarm once a request is 20 calendar days old,
 * i.e. approaching the GDPR/RGPD Art. 12(3) 1-month response deadline
 * (~10 days of buffer before the actual due_at computed by computeDueAtGdpr).
 * All request types share the same threshold — GDPR does not distinguish
 * access vs. erasure requests the way the Brazilian LGPD did.
 *
 * Auth: `Authorization: Bearer <INTERNAL_CRON_SECRET|INTERNAL_SECRET>` (fail-closed).
 * Audit: emits lgpd.sla_watcher_run after processing.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { cronSecretMatches } from "@/lib/auth/cron-secret";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { triggerSlaAlarm } from "@/lib/lgpd/sla-alarm";
import type { LgpdRequest } from "@/lib/lgpd/types";
import type { AlarmThreshold } from "@/lib/lgpd/sla-alarm";

export const dynamic = "force-dynamic";

/** Max requests processed per cron invocation (safety cap). */
const SCAN_LIMIT = 500;

interface OrgRow {
  dpo_email: string | null;
  display_name: string | null;
}

type RequestWithOrg = LgpdRequest & OrgRow;

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const startedAt = Date.now();

  // ────────────────────────────────────────────────────────────────────────
  // Auth — Bearer INTERNAL_CRON_SECRET or INTERNAL_SECRET (fail-closed)
  // ────────────────────────────────────────────────────────────────────────
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";

  if (!cronSecretMatches(provided)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Query — system-wide scan via admin client (bypasses RLS intentionally;
  //          this is a platform-level cron, not a tenant-scoped request)
  // ────────────────────────────────────────────────────────────────────────
  const supabaseAdmin = createAdminClient();

  const { data: rows, error: queryError } = await supabaseAdmin
    .from("lgpd_requests")
    .select(
      `
      *,
      organizations!inner(
        dpo_email,
        display_name
      )
    `,
    )
    .not("status", "in", '("completed","failed")')
    .lte("received_at", new Date(Date.now() - 20 * 86_400_000).toISOString())
    .limit(SCAN_LIMIT);

  if (queryError) {
    logger.error("lgpd-sla-watcher: query failed", { error: queryError.message });
    return fail("internal_error", "Failed to query lgpd_requests.", 500, { requestId });
  }

  const requests = (rows ?? []) as unknown as RequestWithOrg[];

  // ────────────────────────────────────────────────────────────────────────
  // Process each request
  // ────────────────────────────────────────────────────────────────────────
  let alarmedCount = 0;
  let dedupedCount = 0;
  let errorsCount = 0;

  const threshold: AlarmThreshold = "gdpr_deadline_d20";

  for (const row of requests) {
    // Extract org columns from the joined relation
    const orgData = (row as unknown as { organizations: OrgRow }).organizations;
    const dpoEmail = orgData?.dpo_email ?? null;
    const orgName = orgData?.display_name ?? null;

    // Build a clean LgpdRequest (strip joined columns)
    const lgpdRequest: LgpdRequest = {
      id: row.id,
      organization_id: row.organization_id,
      request_type: row.request_type,
      source: row.source,
      contact_id: row.contact_id,
      external_customer_id: row.external_customer_id,
      status: row.status,
      attempts: row.attempts,
      received_at: row.received_at,
      due_at: row.due_at,
      completed_at: row.completed_at,
      request_payload: row.request_payload,
      result: row.result,
      error_message: row.error_message,
      cascaded_to: row.cascaded_to,
      emergency: row.emergency,
      scope: row.scope,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    try {
      const result = await triggerSlaAlarm({
        request: lgpdRequest,
        threshold,
        organizationDpoEmail: dpoEmail,
        organizationName: orgName,
      });

      if (result.reason === "dedup_24h") {
        dedupedCount++;
      } else if (result.alarmed) {
        alarmedCount++;
      } else {
        // alarmed=false but no dedup reason — both sentry + email failed
        errorsCount++;
      }
    } catch (err) {
      errorsCount++;
      logger.error("lgpd-sla-watcher: triggerSlaAlarm threw for request", {
        request_id: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const durationMs = Date.now() - startedAt;
  const scanned = requests.length;

  // ────────────────────────────────────────────────────────────────────────
  // Master audit entry (fire-and-forget)
  // ────────────────────────────────────────────────────────────────────────
  void audit({
    action: "lgpd.sla_watcher_run",
    requestId,
    bypassedRls: true,
    metadata: {
      scanned,
      alarmed: alarmedCount,
      deduped: dedupedCount,
      errors: errorsCount,
      duration_ms: durationMs,
    },
  });

  return ok(
    { scanned, alarmed: alarmedCount, deduped: dedupedCount, errors: errorsCount },
    { requestId },
  );
}
