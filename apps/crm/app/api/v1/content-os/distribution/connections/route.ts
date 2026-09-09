import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { getPostizClientFromEnv } from "@/lib/content-os/providers/postiz/client";
import { PostizDistributionProvider } from "@/lib/content-os/providers/postiz/provider";
import { createConnection, listConnections, type ConnectionRepository, type DistributionConnection } from "@/lib/content-os/distribution/connection-service";

export const dynamic = "force-dynamic";
const inputSchema = z.object({ provider: z.string().trim().min(1).max(64), display_name: z.string().trim().min(1).max(160), provider_input: z.record(z.string(), z.unknown()).optional(), metadata: z.record(z.string(), z.unknown()).optional() }).strict();

function repository(db: Awaited<ReturnType<typeof createClient>>): ConnectionRepository {
  return {
    async list(org) { const { data, error } = await db.from("distribution_connections").select("*").eq("organization_id", org).order("created_at", { ascending: false }); if (error) throw error; return (data ?? []) as unknown as DistributionConnection[]; },
    async find(org, id) { const { data, error } = await db.from("distribution_connections").select("*").eq("organization_id", org).eq("id", id).maybeSingle(); if (error) throw error; return (data as unknown as DistributionConnection | null) ?? null; },
    async create(input) { const { data, error } = await db.from("distribution_connections").insert({ organization_id: input.organizationId, provider: input.provider, display_name: input.displayName, metadata: input.metadata, status: "pending" }).select("*").single(); if (error || !data) throw error ?? new Error("connection_create_failed"); return data as unknown as DistributionConnection; },
    async update(input) { const patch = { ...(input.providerConnectionId !== undefined ? { provider_connection_id: input.providerConnectionId } : {}), ...(input.status ? { status: input.status } : {}), ...(input.lastErrorCode !== undefined ? { last_error_code: input.lastErrorCode, last_error_at: input.lastErrorCode ? new Date().toISOString() : null } : {}) }; const { data, error } = await db.from("distribution_connections").update(patch).eq("organization_id", input.organizationId).eq("id", input.id).select("*").single(); if (error || !data) throw error ?? new Error("connection_update_failed"); return data as unknown as DistributionConnection; },
  };
}

export async function GET(): Promise<Response> {
  const requestId = randomUUID(); const authz = await requireRole("manager", { requestId, resource: "content_os_distribution_connections" }); if (!authz.ok) return authz.response;
  try { return ok(await listConnections(repository(await createClient()), authz.org.orgId), { requestId }); } catch { return fail("internal_error", "Não foi possível listar as conexões.", 500, { requestId }); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID(); const authz = await requireRole("manager", { requestId, resource: "content_os_distribution_connections" }); if (!authz.ok) return authz.response;
  let raw: unknown; try { raw = await req.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = inputSchema.safeParse(raw); if (!parsed.success) return fail("invalid_request", "Dados inválidos.", 400, { requestId, details: parsed.error.flatten() });
  const client = getPostizClientFromEnv(); if (!client || parsed.data.provider !== "postiz") return fail("unavailable", "O provider de distribuição não está configurado.", 503, { requestId });
  try {
    const result = await createConnection(repository(await createClient()), { postiz: new PostizDistributionProvider(client) }, { organizationId: authz.org.orgId, provider: parsed.data.provider, displayName: parsed.data.display_name, providerInput: parsed.data.provider_input, metadata: parsed.data.metadata });
    void audit({ action: "content_os.distribution_connection_created", actorUserId: authz.user.id, organizationId: authz.org.orgId, resourceType: "distribution_connection", resourceId: result.connection.id, requestId, metadata: { provider: result.connection.provider } });
    return ok(result, { requestId, status: 201 });
  } catch (error) { const code = error instanceof Error && "code" in error ? String((error as { code?: unknown }).code) : "internal_error"; return fail(code === "connection_invalid" ? "invalid_request" : code === "connection_provider_error" ? "upstream_unavailable" : "internal_error", "Não foi possível criar a conexão.", code === "connection_provider_error" ? 502 : 500, { requestId }); }
}
