import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { registerContentAsset, ContentAssetValidationError } from "@/lib/content-os/creative/asset-service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const schema = z.object({ asset_type: z.string().trim().min(1).max(80), mime_type: z.string().trim().min(1).max(100), data_base64: z.string().min(1).max(140_000_000), content_item_id: z.string().uuid().nullable().optional(), origin_provider: z.string().trim().max(80).nullable().optional(), metadata: z.record(z.string(), z.unknown()).optional() }).strict();

export async function GET(): Promise<Response> {
  const requestId = randomUUID(); const authz = await requireRole("manager", { requestId, resource: "content_os_assets" }); if (!authz.ok) return authz.response;
  const db = await createClient(); const { data, error } = await db.from("content_assets").select("id,organization_id,content_item_id,asset_type,storage_bucket,storage_path,mime_type,byte_size,checksum,origin_provider,metadata,created_at,updated_at").eq("organization_id", authz.org.orgId).order("created_at", { ascending: false }).limit(100);
  if (error) return fail("internal_error", "Não foi possível listar os assets.", 500, { requestId }); return ok(data ?? [], { requestId });
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID(); const authz = await requireRole("manager", { requestId, resource: "content_os_assets" }); if (!authz.ok) return authz.response;
  let raw: unknown; try { raw = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = schema.safeParse(raw); if (!parsed.success) return fail("invalid_request", "Dados inválidos.", 400, { requestId, details: parsed.error.flatten() });
  try {
    const bytes = Uint8Array.from(Buffer.from(parsed.data.data_base64, "base64")); const db = await createClient();
    const asset = await registerContentAsset({ async create(input) { const { error: uploadError } = await db.storage.from("content-assets").upload(String(input.storage_path), bytes, { contentType: String(input.mime_type), upsert: false }); if (uploadError) throw uploadError; const { data, error } = await db.from("content_assets").insert(input as never).select("*").single(); if (error) throw error; return data as never; } }, { organizationId: authz.org.orgId, assetType: parsed.data.asset_type, mimeType: parsed.data.mime_type, bytes, contentItemId: parsed.data.content_item_id ?? null, originProvider: parsed.data.origin_provider ?? null, metadata: parsed.data.metadata ?? {} });
    return ok(asset, { requestId, status: 201 });
  } catch (error) { if (error instanceof ContentAssetValidationError) return fail(error.code, error.message, 400, { requestId }); return fail("internal_error", "Não foi possível registrar o asset.", 500, { requestId }); }
}
