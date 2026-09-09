/**
 * GET /api/v1/cron/kb-conversations-batch
 *
 * Daily cron entry point for the conversations RAG ingestion (S-06.07).
 * Iterates active agents (one per org) and runs the anonymizer + chunker +
 * embedder + KB version build for each.
 *
 * Auth: `Authorization: Bearer <INTERNAL_CRON_SECRET>`. The secret is
 * env-gated and OPTIONAL: when absent, the endpoint refuses every request
 * (fail-closed) so a misconfigured deploy does not silently expose the cron.
 *
 * The legacy `INTERNAL_SECRET` is also accepted to keep parity with other
 * internal cron callers.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { cronSecretMatches } from "@/lib/auth/cron-secret";
import { ingestConversationsBatch } from "@/lib/ai/rag/ingest/conversations";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const LOOKBACK_HOURS = 24;
/**
 * Teto de orgs processadas por rodada — sem ele, um install com muitos
 * tenants ativos arrisca estourar o tempo de request numa rota HTTP síncrona
 * (embedding é I/O pesado, por org). Sem paginação/cursor real, o corte
 * embaralha a ordem a cada rodada (Fisher–Yates) em vez de sempre pegar os
 * mesmos primeiros N — senão orgs "depois" na query nunca seriam ingeridas
 * em instalações grandes.
 */
const ORG_LIMIT = 50;

function embaralhado<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

interface AgentRow {
  id: string;
  organization_id: string;
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";

  if (!cronSecretMatches(provided)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  const admin = createAdminClient();
  const sinceTs = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);

  const { data: agentRows, error: agentErr } = await admin
    .from("ai_agents")
    .select("id, organization_id")
    .eq("is_active", true);

  if (agentErr) {
    logger.error("kb-conversations-cron: agent list failed", { error: agentErr.message });
    return fail("internal_error", agentErr.message, 500, { requestId });
  }

  const agents = (agentRows ?? []) as AgentRow[];
  // Pick one agent per org (first active wins) to avoid double-ingesting.
  const seenOrgs = new Set<string>();
  const uniqueAll: AgentRow[] = [];
  for (const a of agents) {
    if (seenOrgs.has(a.organization_id)) continue;
    seenOrgs.add(a.organization_id);
    uniqueAll.push(a);
  }

  const shuffled = embaralhado(uniqueAll);
  const unique = shuffled.slice(0, ORG_LIMIT);
  const droppedThisRound = shuffled.length - unique.length;
  if (droppedThisRound > 0) {
    logger.info("kb-conversations-cron: teto de orgs por rodada atingido", {
      orgs_elegiveis: shuffled.length,
      orgs_processadas: unique.length,
      orgs_deixadas_pra_proxima_rodada: droppedThisRound,
    });
  }

  let totalProcessed = 0;
  let totalFlagged = 0;
  let totalSkipped = 0;
  let orgsProcessed = 0;
  const failures: string[] = [];

  for (const agent of unique) {
    try {
      const result = await ingestConversationsBatch({
        organizationId: agent.organization_id,
        agentId: agent.id,
        sinceTs,
      });
      orgsProcessed++;
      totalProcessed += result.processed;
      totalFlagged += result.flaggedReview;
      totalSkipped += result.skipped;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      logger.error("kb-conversations-cron: org failed", {
        organization_id: agent.organization_id,
        error: detail,
      });
      failures.push(`${agent.organization_id}:${detail}`);
    }
  }

  await audit({
    action: "rag.conversations_batch_run",
    organizationId: null,
    metadata: {
      orgs_processed: orgsProcessed,
      total_processed: totalProcessed,
      total_flagged: totalFlagged,
      total_skipped: totalSkipped,
      failures: failures.length,
      since_ts: sinceTs.toISOString(),
      orgs_dropped_this_round: droppedThisRound,
    },
    requestId,
  });

  return ok(
    {
      orgs_processed: orgsProcessed,
      total_processed: totalProcessed,
      total_flagged: totalFlagged,
      total_skipped: totalSkipped,
      failures,
    },
    { requestId },
  );
}
