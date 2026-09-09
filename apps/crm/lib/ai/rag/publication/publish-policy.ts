/**
 * Publishes a policy knowledge source (PDF or Markdown) for an agent.
 *
 * Extracted from POST /api/v1/ai/knowledge/sources/upload (task 4, AI platform
 * phase 3) so the same ingestion path can be reused by the Obsidian
 * publication flow. Takes organization/actor identity only as already-resolved
 * parameters from an authenticated caller — never reads cookies/session and
 * never accepts an organization id from anywhere but the caller's argument.
 *
 * Uses the admin (service-role) client throughout, so every tenant-aware
 * query filters `organization_id` manually (multi-tenancy rule) instead of
 * relying on the user-scoped RLS client the HTTP route used before extraction.
 */

import { randomUUID } from "node:crypto";

import type { ApiErrorCode } from "@/lib/api/errors";
import { ingestPolicyFile, PdfExtractError } from "@/lib/ai/rag/ingest/policy";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const MAX_POLICY_FILE_BYTES = 20 * 1024 * 1024; // 20MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/markdown",
  "text/x-markdown",
  "text/plain", // some systems send .md as text/plain
]);

const ALLOWED_EXTENSIONS = new Set(["pdf", "md"]);

function resolvePolicyExt(filename: string, mimeType: string): "pdf" | "md" | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "md") return "md";
  // Fallback by MIME
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "text/markdown" || mimeType === "text/x-markdown") return "md";
  return null;
}

export class PublishKnowledgePolicyError extends Error {
  constructor(
    public readonly code: ApiErrorCode | (string & {}),
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PublishKnowledgePolicyError";
  }
}

export interface PublishKnowledgePolicyInput {
  organizationId: string;
  agentId: string;
  actorUserId: string;
  name: string;
  file: { name: string; mimeType: string; bytes: Buffer };
}

export interface PublishKnowledgePolicyResult {
  sourceId: string;
  blobPath: string;
}

export async function publishKnowledgePolicy(
  input: PublishKnowledgePolicyInput,
): Promise<PublishKnowledgePolicyResult> {
  const { organizationId, agentId, actorUserId, name, file } = input;

  if (file.bytes.length > MAX_POLICY_FILE_BYTES) {
    throw new PublishKnowledgePolicyError(
      "payload_too_large",
      413,
      "Arquivo excede o limite de 20MB.",
    );
  }

  const ext = resolvePolicyExt(file.name, file.mimeType);
  const isMimeAllowed =
    ALLOWED_MIME_TYPES.has(file.mimeType) ||
    ALLOWED_EXTENSIONS.has(file.name.split(".").pop()?.toLowerCase() ?? "");

  if (!isMimeAllowed || !ext) {
    throw new PublishKnowledgePolicyError(
      "unsupported_media_type",
      415,
      "Tipo de arquivo não suportado. Envie PDF ou Markdown (.pdf, .md).",
    );
  }

  const admin = createAdminClient();

  // Agent ownership — admin client bypasses RLS, so organization_id is
  // filtered explicitly instead of relying on the caller's session.
  const { data: agent, error: agentErr } = await admin
    .from("ai_agents")
    .select("id")
    .eq("id", agentId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (agentErr) {
    logger.error("ai-policy-publish: agent lookup failed", {
      organizationId,
      agentId,
      error: agentErr.message,
    });
    throw new PublishKnowledgePolicyError("internal_error", 500, "Erro ao validar agent_id.");
  }
  if (!agent) {
    throw new PublishKnowledgePolicyError(
      "not_found",
      404,
      "Agent não encontrado nesta organização.",
    );
  }

  const blobId = randomUUID();
  const blobPath = `${organizationId}/${blobId}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from("ai-policy")
    .upload(blobPath, file.bytes, { contentType: file.mimeType, upsert: false });

  if (uploadErr) {
    logger.error("ai-policy-publish: storage upload failed", {
      organizationId,
      blobPath,
      error: uploadErr.message,
    });
    throw new PublishKnowledgePolicyError("internal_error", 500, "Erro ao fazer upload do arquivo.");
  }

  // Validate extraction inline before committing the DB row. A failed
  // extraction triggers cleanup of the blob we just uploaded.
  let chunkCount = 0;
  try {
    // No knowledgeSourceId yet — ingestPolicyFile only uses it for logging
    // when the ks row already exists.
    const result = await ingestPolicyFile({
      organizationId,
      agentId,
      knowledgeSourceId: "pre-insert-validation",
      blobPath,
      ext,
    });
    chunkCount = result.chunkCount;
  } catch (err) {
    await admin.storage.from("ai-policy").remove([blobPath]);

    if (err instanceof PdfExtractError) {
      throw new PublishKnowledgePolicyError(
        "unprocessable_entity",
        422,
        "Não foi possível extrair texto do PDF. Verifique se o arquivo não é somente imagens.",
      );
    }
    logger.error("ai-policy-publish: extraction failed", {
      organizationId,
      blobPath,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new PublishKnowledgePolicyError("internal_error", 500, "Erro ao processar o arquivo.");
  }

  const sourceMetadata = {
    filename: file.name,
    blob_path: blobPath,
    version: 1,
    uploaded_by: actorUserId,
    mime_type: file.mimeType,
    size_bytes: file.bytes.length,
    chunk_count: chunkCount,
  };

  const { data: ks, error: ksErr } = await admin
    .from("ai_knowledge_sources")
    .insert({
      organization_id: organizationId,
      agent_id: agentId,
      source_type: "policy",
      name,
      status: "ready",
      ingested_at: new Date().toISOString(),
      source_metadata: sourceMetadata,
    })
    .select("id")
    .single();

  if (ksErr || !ks) {
    await admin.storage.from("ai-policy").remove([blobPath]);
    logger.error("ai-policy-publish: insert knowledge source failed", {
      organizationId,
      blobPath,
      error: ksErr?.message,
    });
    throw new PublishKnowledgePolicyError(
      "internal_error",
      500,
      "Erro ao registrar fonte de conhecimento.",
    );
  }

  const sourceId = (ks as { id: string }).id;

  // Fire-and-forget: emit failure is non-blocking (audit-observability rule).
  const { error: emitErr } = await admin.rpc("emit_event" as never, {
    p_event_type: "knowledge_source.updated",
    p_entity_kind: "ai_knowledge_source",
    p_entity_id: sourceId,
    p_payload: {
      knowledge_source_id: sourceId,
      agent_id: agentId,
      source_type: "policy",
    },
    p_organization_id: organizationId,
  } as never);

  if (emitErr) {
    logger.warn("ai-policy-publish: emit_event failed (non-blocking)", {
      organizationId,
      sourceId,
      error: emitErr.message,
    });
  }

  return { sourceId, blobPath };
}
