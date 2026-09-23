import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createSSEStream } from "@/lib/realtime/sse";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes (Vercel max execution time limit configuration if applicable)

const NO_STORE = { "cache-control": "no-store, max-age=0" } as const;

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  const organizationId = req.nextUrl.searchParams.get("organization_id");

  if (!organizationId) {
    return fail("invalid_request", "organization_id is required", 400, {
      requestId,
      headers: NO_STORE,
    });
  }

  // F1, F2, F3 verification: role must be at least viewer in the requested tenant
  const roleCheck = await requireRole("viewer", {
    requestId,
    organizationId,
  });

  if (!roleCheck.ok) {
    return roleCheck.response;
  }

  const cursorParam = req.nextUrl.searchParams.get("cursor");
  const cursor = cursorParam ? new Date(cursorParam) : new Date();

  if (isNaN(cursor.getTime())) {
    return fail("invalid_request", "invalid cursor format", 400, {
      requestId,
      headers: NO_STORE,
    });
  }

  // This abstracts the polling loop + readable stream management
  return createSSEStream(roleCheck.org.orgId, cursor, req.signal);
}
