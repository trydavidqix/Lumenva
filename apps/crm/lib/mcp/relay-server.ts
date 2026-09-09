import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { env } from "@/lib/env";

export const relayInputSchema = z.object({ message_id: z.string().trim().min(1).max(200), thread_id: z.string().trim().min(1).max(200), from: z.string().trim().min(1).max(320), to: z.string().trim().min(1).max(320), subject: z.string().trim().min(1).max(500), summary: z.string().trim().min(1).max(4000), action: z.string().trim().min(1).max(1000), deadline: z.string().trim().min(1).max(200), urgency: z.string().trim().min(1).max(100), source: z.string().trim().min(1).max(100) });
export function createRelayMcpServer(requestId: string, origin: string): McpServer {
  const server = new McpServer({ name: "lumenva-email-relay", version: "1.0.0" });
  server.registerTool("relayEmailNotification", { description: "Send a summarized Gmail notification to the configured owner's WhatsApp.", inputSchema: relayInputSchema.shape }, async (raw) => {
    const input = relayInputSchema.parse(raw);
    const response = await fetch(new URL("/api/internal/notifications/email", origin).toString(), { method: "POST", headers: { authorization: `Bearer ${env.INTERNAL_SECRET}`, "content-type": "application/json", "x-request-id": requestId }, body: JSON.stringify(input) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { isError: true, content: [{ type: "text", text: typeof body?.error?.message === "string" ? body.error.message : "Email notification could not be delivered." }] };
    return { content: [{ type: "text", text: JSON.stringify(body.data || body) }], structuredContent: (body.data || body) as Record<string, unknown> };
  });
  return server;
}
