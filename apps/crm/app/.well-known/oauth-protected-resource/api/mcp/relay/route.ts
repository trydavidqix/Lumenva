import { env } from "@/lib/env";
export function GET(): Response { const resource = `${env.MCP_RELAY_ISSUER}/api/mcp/relay`; return Response.json({ resource, authorization_servers: [env.MCP_RELAY_ISSUER], scopes_supported: ["email:relay"] }); }
