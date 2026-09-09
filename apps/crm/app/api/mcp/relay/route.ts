import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { env } from "@/lib/env";
import { validateAccessToken, relayResource } from "@/lib/oauth/relay-store";
import { createRelayMcpServer } from "@/lib/mcp/relay-server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function unauthorized(): Response { return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json", "www-authenticate": `Bearer resource_metadata="${new URL("/.well-known/oauth-protected-resource/api/mcp/relay", env.MCP_RELAY_ISSUER)}", scope="email:relay"` } }); }
async function handle(req: NextRequest): Promise<Response> { if (!env.MCP_RELAY_ENABLED) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "content-type": "application/json" } }); const match = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || ""); if (!match) return unauthorized(); const grant = await validateAccessToken(match[1]!); if (!grant || grant.resource !== relayResource(env.MCP_RELAY_ISSUER) || grant.scope !== "email:relay") return unauthorized(); const requestId = randomUUID(); const transport = new WebStandardStreamableHTTPServerTransport({}); const server = createRelayMcpServer(requestId, req.nextUrl.origin); await server.connect(transport); const response = await transport.handleRequest(req as unknown as Request); response.headers.set("x-request-id", requestId); return response; }
export async function GET(req: NextRequest): Promise<Response> { return handle(req); }
export async function POST(req: NextRequest): Promise<Response> { return handle(req); }
export async function DELETE(req: NextRequest): Promise<Response> { return handle(req); }
