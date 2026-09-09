/**
 * POST /api/v1/ai/knowledge/sources/upload
 *
 * Multipart upload for policy files (PDF or Markdown, max 20MB).
 * Uploads to private `ai-policy` bucket, inserts ai_knowledge_sources row,
 * validates extraction inline, and emits knowledge_source.updated event.
 *
 * Auth: cookie session. Role >= manager required.
 * organization_id is resolved from JWT — NEVER from request body.
 *
 * The ingestion itself (storage/validation/source/event work) lives in
 * `publishKnowledgePolicy` (lib/ai/rag/publication/publish-policy.ts) so it
 * can be reused by non-HTTP callers (e.g. Obsidian publication). This route
 * only owns auth and multipart/HTTP parsing.
 */

import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/wrappers";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { requireRole } from "@/lib/auth/require-role";
import {
  publishKnowledgePolicy,
  PublishKnowledgePolicyError,
  MAX_POLICY_FILE_BYTES,
} from "@/lib/ai/rag/publication/publish-policy";

export const dynamic = "force-dynamic";

const nameSchema = z.string().min(2).max(120);
const agentIdSchema = z.string().uuid();

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  // --- Auth ---
  const authz = await requireRole("manager", { requestId, resource: "ai_knowledge" });
  if (!authz.ok) return authz.response;
  const { user: authUser, org: activeOrg } = authz;

  // Extração de PDF é I/O pesado por request; sem teto, upload repetido vira
  // custo/DoS sem passar por nenhum outro guard.
  const rl = await checkRateLimit(`ai_knowledge_upload:${activeOrg.orgId}`, 20, 60);
  if (!rl.allowed) {
    return fail("rate_limited", "Muitos uploads em pouco tempo.", 429, {
      requestId,
      headers: { "Retry-After": "60" },
    });
  }

  // --- Parse multipart ---
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail("invalid_request", "Falha ao processar multipart/form-data.", 400, { requestId });
  }

  const fileEntry = formData.get("file");
  const agentIdRaw = formData.get("agent_id");
  const nameRaw = formData.get("name");

  if (!(fileEntry instanceof File)) {
    return fail("invalid_request", "Campo 'file' ausente ou inválido.", 400, { requestId });
  }

  // --- Validate agent_id and name shape ---
  const agentIdParsed = agentIdSchema.safeParse(agentIdRaw);
  if (!agentIdParsed.success) {
    return fail("validation_failed", "Campo 'agent_id' deve ser UUID válido.", 422, { requestId });
  }
  const nameParsed = nameSchema.safeParse(nameRaw);
  if (!nameParsed.success) {
    return fail("validation_failed", "Campo 'name' inválido (2-120 chars).", 422, { requestId });
  }

  const agentId = agentIdParsed.data;
  const name = nameParsed.data;
  const file = fileEntry;

  // --- File size check (before buffering) ---
  // Reject oversized files using the File/Blob's reported size *before*
  // materializing the full buffer in memory — buffering first would let an
  // oversized upload consume memory before it's rejected.
  if (file.size > MAX_POLICY_FILE_BYTES) {
    return fail("payload_too_large", "Arquivo excede o limite de 20MB.", 413, { requestId });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  try {
    const { sourceId, blobPath } = await publishKnowledgePolicy({
      organizationId: activeOrg.orgId,
      agentId,
      actorUserId: authUser.id,
      name,
      file: { name: file.name, mimeType: file.type, bytes: fileBuffer },
    });

    return ok({ id: sourceId, blob_path: blobPath }, { status: 201, requestId });
  } catch (err) {
    if (err instanceof PublishKnowledgePolicyError) {
      return fail(err.code, err.message, err.status, { requestId });
    }
    return fail("internal_error", "Erro ao processar o arquivo.", 500, { requestId });
  }
}
