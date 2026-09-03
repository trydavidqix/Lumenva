import { z } from "zod";
import { registerClient } from "@/lib/oauth/relay-store";
const schema = z.object({ client_name: z.string().max(120).optional(), redirect_uris: z.array(z.string().url()).min(1).max(5), grant_types: z.array(z.string()).optional(), response_types: z.array(z.string()).optional(), token_endpoint_auth_method: z.string().optional() });
export async function POST(req: Request): Promise<Response> {
  try { const input = schema.parse(await req.json()); if (input.redirect_uris.some((u) => !u.startsWith("https://") && !u.startsWith("http://localhost") && !u.startsWith("http://127.0.0.1"))) return Response.json({ error: "invalid_redirect_uri" }, { status: 400 }); const c = await registerClient({ clientName: input.client_name, redirectUris: input.redirect_uris }); return Response.json({ client_id: c.clientId, client_name: c.clientName, redirect_uris: c.redirectUris, grant_types: ["authorization_code"], response_types: ["code"], token_endpoint_auth_method: "none" }, { status: 201 }); } catch { return Response.json({ error: "invalid_client_metadata" }, { status: 400 }); }
}
