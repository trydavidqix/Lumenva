/**
 * MCP server endpoint (Spec 11 §2 + §5.4).
 *
 * Streamable HTTP transport via `WebStandardStreamableHTTPServerTransport`
 * (Next.js App Router recebe Web `Request`). Stateless: cada request abre
 * um transport+server fresh. Auth via Bearer (`api_tokens`).
 *
 * NUNCA logamos plaintext do bearer. Em erro retornamos JSON-RPC 2.0
 * envelope com `error.code` MCP (-32001/-32002/etc).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { createMcpServer } from "@/lib/mcp/server";
import { McpAuthError, validateBearerToken } from "@/lib/mcp/auth";
import {
  MCP_RATE_LIMIT,
  MCP_RATE_WINDOW_SEC,
  mcpAuthAttemptAllowed,
  recordMcpAuthFailure,
} from "@/lib/mcp/auth-rate-limit";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Teto por org: sem ele, um bearer `api_tokens` vazado/guessado chama
 * qualquer tool (inclusive as de escrita — crm_create_lead, crm_send_whatsapp_message)
 * quantas vezes quiser por segundo, só com audit depois do fato. 120/min
 * (2/s) é generoso pro uso legítimo de agente automatizado; um flood
 * malicioso ainda esbarra nele.
 */
function rateLimitHeaders(
  result: { count: number; limit: number; window_sec: number },
  retryAfter: boolean,
) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.limit - result.count)),
    ...(retryAfter ? { "Retry-After": String(result.window_sec) } : {}),
  };
}

function jsonRpcError(
  code: number,
  message: string,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code, message },
      id: null,
    }),
    {
      status,
      headers: { "content-type": "application/json", ...extraHeaders },
    },
  );
}

async function handle(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const authRate = await mcpAuthAttemptAllowed(req);
  if (!authRate.allowed) {
    return jsonRpcError(-32000, "rate_limited", 429, rateLimitHeaders(authRate, true));
  }

  let auth;
  try {
    auth = await validateBearerToken(req.headers.get("authorization"));
  } catch (err) {
    if (err instanceof McpAuthError) {
      if (err.httpStatus === 401) {
        const failedAuthRate = await recordMcpAuthFailure(req);
        if (!failedAuthRate.allowed) {
          return jsonRpcError(-32000, "rate_limited", 429, rateLimitHeaders(failedAuthRate, true));
        }
        return jsonRpcError(
          err.mcpCode,
          err.message,
          err.httpStatus,
          rateLimitHeaders(failedAuthRate, false),
        );
      }
      return jsonRpcError(err.mcpCode, err.message, err.httpStatus);
    }
    const msg = err instanceof Error ? err.message : "auth_failed";
    return jsonRpcError(-32603, msg, 500);
  }

  const rl = await checkRateLimit(
    `mcp:${auth.organizationId}`,
    MCP_RATE_LIMIT,
    MCP_RATE_WINDOW_SEC,
  );
  if (!rl.allowed) {
    return jsonRpcError(-32000, "rate_limited", 429, rateLimitHeaders(rl, true));
  }

  const transport = new WebStandardStreamableHTTPServerTransport({});
  const server = createMcpServer(auth, requestId);

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(req as unknown as Request);
    response.headers.set("X-Request-Id", requestId);
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "transport_error";
    return jsonRpcError(-32603, msg, 500);
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  return handle(req);
}

export async function GET(req: NextRequest): Promise<Response> {
  return handle(req);
}

export async function DELETE(req: NextRequest): Promise<Response> {
  return handle(req);
}
