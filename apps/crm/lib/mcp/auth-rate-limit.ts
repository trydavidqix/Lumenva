/**
 * Throttle MCP bearer authentication failures before `api_tokens` is queried.
 *
 * The shared limiter is the existing Upstash Redis counter with its documented
 * in-memory fallback. The bucket is opaque so neither the client IP nor a token
 * ever becomes readable Redis key material. Valid tokens do not consume this
 * budget; the route records only 401 authentication failures.
 *
 * This is a fixed window because that is what the shared `checkRateLimit` helper
 * implements today. It is an abuse-cost guard, not a precise traffic shaper.
 */
import { createHash } from "node:crypto";

import {
  checkRateLimit,
  peekRateLimit,
  type RateLimitResult,
} from "@/lib/ai/dispatcher/rate-limit";

/** Existing post-auth MCP surface limit, preserved from the route. */
export const MCP_RATE_LIMIT = 120;
export const MCP_RATE_WINDOW_SEC = 60;

/** New pre-lookup failed-auth limit. */
export const MCP_AUTH_RATE_LIMIT = 30;
export const MCP_AUTH_RATE_WINDOW_SEC = 60;

type RequestWithOptionalIp = Pick<Request, "headers"> & { ip?: string | null };

function opaque(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}

function clientAddress(request: RequestWithOptionalIp): string | null {
  // `request.ip` is supplied by some managed runtimes. The headers cover the
  // reverse-proxy conventions used by the self-host kit and existing auth code.
  const runtimeIp = request.ip?.trim();
  if (runtimeIp) return runtimeIp;

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;

  const cloudflare = request.headers.get("cf-connecting-ip")?.trim();
  return cloudflare || null;
}

export function mcpAuthRateLimitBucket(request: RequestWithOptionalIp): string | null {
  const address = clientAddress(request);
  return address ? `mcp:auth:ip:${opaque(address)}` : null;
}

/** Consult the failed-attempt counter before doing the expensive token lookup. */
export async function mcpAuthAttemptAllowed(
  request: RequestWithOptionalIp,
): Promise<RateLimitResult> {
  const bucket = mcpAuthRateLimitBucket(request);
  if (!bucket) {
    // Never put all self-host callers without proxy headers in one global
    // bucket: forged failures must not lock out every valid tenant.
    return {
      allowed: true,
      count: 0,
      limit: MCP_AUTH_RATE_LIMIT,
      window_sec: MCP_AUTH_RATE_WINDOW_SEC,
    };
  }
  const count = await peekRateLimit(bucket, MCP_AUTH_RATE_WINDOW_SEC);
  return {
    allowed: count < MCP_AUTH_RATE_LIMIT,
    count,
    limit: MCP_AUTH_RATE_LIMIT,
    window_sec: MCP_AUTH_RATE_WINDOW_SEC,
  };
}

/** Record one 401 auth failure after the token lookup has failed. */
export async function recordMcpAuthFailure(
  request: RequestWithOptionalIp,
): Promise<RateLimitResult> {
  const bucket = mcpAuthRateLimitBucket(request);
  if (!bucket) {
    return {
      allowed: true,
      count: 0,
      limit: MCP_AUTH_RATE_LIMIT,
      window_sec: MCP_AUTH_RATE_WINDOW_SEC,
    };
  }
  return checkRateLimit(bucket, MCP_AUTH_RATE_LIMIT, MCP_AUTH_RATE_WINDOW_SEC);
}
