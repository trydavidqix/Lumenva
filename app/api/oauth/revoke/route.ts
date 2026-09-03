import { z } from "zod";
import { revokeAccessToken } from "@/lib/oauth/relay-store";
export async function POST(req: Request): Promise<Response> { const body = await req.formData().catch(() => null); const token = z.string().min(1).safeParse(body?.get("token")); if (token.success) await revokeAccessToken(token.data); return new Response(null, { status: 200 }); }
