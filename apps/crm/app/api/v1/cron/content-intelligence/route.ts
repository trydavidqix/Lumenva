import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { cronSecretMatches } from "@/lib/auth/cron-secret";
import { createSupabaseIntelligenceWorker, runIntelligenceWorker } from "@/lib/content-os/intelligence/worker";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Private scheduler boundary. It never accepts organization/source IDs from a request. */
export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : request.headers.get("x-cron-secret")?.trim() ?? "";
  if (!cronSecretMatches(provided)) return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });

  try {
    const result = await runIntelligenceWorker(createSupabaseIntelligenceWorker(createAdminClient()));
    return ok(result, { requestId });
  } catch {
    return fail("internal_error", "Content intelligence worker unavailable.", 503, { requestId });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  return GET(request);
}
