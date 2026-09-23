/**
 * GET /api/v1/auth/realtime-token
 *
 * DEPRECATED: F5 Task 4 - replaced by /api/v1/realtime/events (app-owned SSE server boundary)
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { fail } from "@/lib/api/wrappers";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store, max-age=0" } as const;

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  return fail(
    "gone",
    "Realtime websocket tokens are no longer issued. Use Server-Sent Events via /api/v1/realtime/events.",
    410,
    { requestId, headers: NO_STORE }
  );
}
