/**
 * Storage redaction queue — drains `storage_redaction_queue` rows enqueued by
 * the cascade RPC and removes the underlying objects from Supabase Storage.
 *
 * Idempotent: rows are claimed by status transition pending → processing
 * (we set processed_at + attempts++) and finalized to deleted | failed |
 * skipped. Re-runs ignore terminal rows.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

import { getGcsBucket } from "@lumenva/db/gcp/cloud-storage";
import { createGcsObjectStore } from "@lumenva/db/storage/gcs";

export interface DrainStats {
  attempted: number;
  deleted: number;
  failed: number;
  skipped: number;
}

interface QueueRow {
  id: string;
  organization_id: string;
  bucket: string;
  object_path: string;
  attempts: number;
}

const MAX_ATTEMPTS = 3;
const DEFAULT_BATCH = 50;

/**
 * Pull up to `limit` pending rows and process them sequentially.
 *
 * Caller responsibility: throttle invocation via cron. The function returns
 * after one batch — repeat invocation drains the rest.
 */
export async function drainStorageRedactionQueue(
  opts: { limit?: number } = {},
): Promise<DrainStats> {
  const admin = createAdminClient();
  const limit = opts.limit ?? DEFAULT_BATCH;

  const stats: DrainStats = { attempted: 0, deleted: 0, failed: 0, skipped: 0 };

  const { data: rows, error } = await admin
    .from("storage_redaction_queue")
    .select("id, organization_id, bucket, object_path, attempts")
    .eq("status", "pending")
    .order("enqueued_at", { ascending: true })
    .limit(limit);

  if (error) {
    logger.error("[lgpd-redact-worker] queue select failed", {
      error_message: error.message,
    });
    return stats;
  }

  const queueRows = (rows ?? []) as QueueRow[];

  if (queueRows.length > 0) {
    const store = createGcsObjectStore(getGcsBucket());

    for (const row of queueRows) {
      stats.attempted++;
      const nextAttempts = row.attempts + 1;

      try {
        let notFound = false;
        try {
          await store.delete({ provider: "gcs", bucket: row.bucket, key: row.object_path });
        } catch (removeErr) {
          const msg = removeErr instanceof Error ? removeErr.message : String(removeErr);
          notFound = /not\s+found|not_found|no such/i.test(msg);
          if (!notFound) {
            throw removeErr;
          }
        }

        if (notFound) {
          await admin
            .from("storage_redaction_queue")
            .update({
              status: "skipped",
              attempts: nextAttempts,
              processed_at: new Date().toISOString(),
              error_message: "object_not_found",
            })
            .eq("id", row.id);
          stats.skipped++;
          continue;
        }

        await admin
          .from("storage_redaction_queue")
          .update({
            status: "deleted",
            attempts: nextAttempts,
            processed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", row.id);
        stats.deleted++;
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        const terminal = nextAttempts >= MAX_ATTEMPTS;
        await admin
          .from("storage_redaction_queue")
          .update({
            status: terminal ? "failed" : "pending",
            attempts: nextAttempts,
            processed_at: terminal ? new Date().toISOString() : null,
            error_message: detail.slice(0, 500),
          })
          .eq("id", row.id);
        if (terminal) stats.failed++;
        logger.warn("[lgpd-redact-worker] media remove failed", {
          queue_id: row.id,
          organization_id: row.organization_id,
          attempts: nextAttempts,
          terminal,
        });
      }
    }
  }

  return stats;
}
