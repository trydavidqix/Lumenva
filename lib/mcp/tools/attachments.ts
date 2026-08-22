/**
 * Anexo do cliente (WhatsApp) → Google Drive do lead (Composio).
 *
 * Diferente das tools Composio expostas DIRETO ao modelo (composio_apps,
 * ver ../agent-engine/edge/llm/composio-tools.ts), esta tool chama a Composio
 * PROGRAMATICAMENTE por dentro do handler (`composio.tools.execute(...)`,
 * fora do loop de tool-calling do LLM) — o modelo só vê `crm_upload_lead_
 * attachment(contact_id)` e um resultado; a orquestração de achar/criar
 * pasta + baixar do WhatsApp + subir pro Drive é decidida aqui, não pelo
 * modelo. Evita o LLM inventar estrutura de pasta errada e mantém a chamada
 * de fora do orçamento de tokens/steps do turno normal.
 */
import { Composio } from "@composio/core";
import { z } from "zod";

import { resolveActiveLeadForContact, type LeadCandidate } from "@/lib/leads/active-lead";
import { buildLeadActivityRow } from "@/lib/leads/activity-emitter";
import type { McpContext, McpToolDefinition } from "../types";

let client: Composio | null = null;

/** Mesmo padrão de singleton do composio-tools.ts do agent-engine — client
 *  próprio aqui porque esta tool nunca passa por VercelProvider (não é
 *  exposta como Tool do AI SDK, é chamada direto no handler). */
function getClient(apiKey: string): Composio {
  if (client === null) client = new Composio({ apiKey });
  return client;
}

interface DriveFile {
  id: string;
  name?: string;
  webViewLink?: string;
}

const inputShape = {
  contact_id: z.string().uuid(),
};

export const crmUploadLeadAttachment: McpToolDefinition<typeof inputShape> = {
  name: "crm_upload_lead_attachment",
  description:
    "Sobe o arquivo/foto/vídeo/documento mais recente enviado pelo contato no WhatsApp para uma " +
    "pasta do Google Drive dedicada ao negócio (lead) aberto dele, e registra o link na timeline. " +
    "Recusa se não houver anexo recente ou negócio aberto único.",
  inputSchema: inputShape,
  category: "write",
  requiresRole: "agent",
  requiresScope: "mcp:write",
  handler: async (input, ctx: McpContext) => {
    const apiKey = process.env.COMPOSIO_API_KEY ?? "";
    if (apiKey === "") throw new Error("composio_not_configured");

    const { data: candidatos, error: errCand } = await ctx.supabase
      .from("crm_leads")
      .select("id, organization_id, pipeline_id, status, last_activity_at, created_at")
      .eq("organization_id", ctx.organizationId)
      .eq("contact_id", input.contact_id);
    if (errCand) throw new Error(`erro ao buscar leads do contato: ${errCand.message}`);

    const { data: pipelinesDefault } = await ctx.supabase
      .from("crm_pipelines")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("is_default", true)
      .eq("is_archived", false)
      .limit(1);

    const alvo = resolveActiveLeadForContact((candidatos ?? []) as LeadCandidate[], {
      defaultPipelineId: pipelinesDefault?.[0]?.id ?? null,
    });
    if (!alvo.routed) throw new Error(alvo.reason);

    const { data: conversas } = await ctx.supabase
      .from("conversations")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("contact_id", input.contact_id);
    const conversationIds = (conversas ?? []).map((c) => c.id as string);
    if (conversationIds.length === 0) throw new Error("no_media_message");

    const { data: mensagens, error: errMsg } = await ctx.supabase
      .from("messages")
      .select("id, media_storage_path, media_mime, created_at")
      .eq("organization_id", ctx.organizationId)
      .in("conversation_id", conversationIds)
      .not("media_storage_path", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (errMsg) throw new Error(`erro ao buscar anexo: ${errMsg.message}`);
    const msg = mensagens?.[0];
    if (!msg?.media_storage_path) throw new Error("no_media_message");

    const { data: signed, error: errSign } = await ctx.supabase.storage
      .from("whatsapp-media")
      .createSignedUrl(msg.media_storage_path as string, 600);
    if (errSign || !signed?.signedUrl) {
      throw new Error(`erro ao gerar link do anexo: ${errSign?.message ?? "sem signedUrl"}`);
    }

    const composio = getClient(apiKey);
    const userId = ctx.organizationId;
    const mime = (msg.media_mime as string | null) ?? "application/octet-stream";
    const ext = mime.split("/")[1]?.split(";")[0] ?? "bin";
    const fileName = `${msg.id}.${ext}`;
    const folderName = `Lead ${alvo.leadId}`;

    const found = await composio.tools.execute(
      "GOOGLEDRIVE_FIND_FOLDER",
      { userId, arguments: { name_exact: folderName }, dangerouslySkipVersionCheck: true },
    );
    const existingFolders = (found.data as { files?: DriveFile[] } | undefined)?.files ?? [];
    let folderId = existingFolders[0]?.id;
    if (folderId === undefined) {
      const created = await composio.tools.execute(
        "GOOGLEDRIVE_CREATE_FOLDER",
        { userId, arguments: { name: folderName }, dangerouslySkipVersionCheck: true },
      );
      folderId = (created.data as { id?: string } | undefined)?.id;
      if (folderId === undefined) throw new Error("drive_folder_create_failed");
    }

    const uploaded = await composio.tools.execute(
      "GOOGLEDRIVE_UPLOAD_FROM_URL",
      {
        userId,
        arguments: {
          source_url: signed.signedUrl,
          name: fileName,
          mime_type: mime,
          parent_folder_id: folderId,
        },
        dangerouslySkipVersionCheck: true,
      },
    );
    const file = uploaded.data as { id?: string; webViewLink?: string } | undefined;
    if (!file?.id) throw new Error("drive_upload_failed");
    const viewLink = file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`;

    const row = buildLeadActivityRow({
      organizationId: ctx.organizationId,
      leadId: alvo.leadId,
      contactId: input.contact_id,
      type: "note",
      sourceModule: "mcp.crm_upload_lead_attachment",
      actor: ctx.actor,
      reason: `Anexo do cliente salvo no Drive: ${viewLink}`,
      payload: { drive_file_id: file.id, message_id: msg.id, mime },
    });
    const { error: errInsert } = await ctx.supabase.from("crm_lead_activities").insert({
      organization_id: row.organization_id,
      lead_id: row.lead_id,
      contact_id: row.contact_id,
      type: row.type,
      source_module: row.source_module,
      source_id: row.source_id,
      actor_kind: row.actor_kind,
      actor_agent_id: row.actor_agent_id,
      performed_by_user_id: row.performed_by_user_id,
      reason: row.reason,
      evidence: row.evidence,
      payload: row.payload,
    });
    if (errInsert) throw new Error(`erro ao gravar nota do anexo: ${errInsert.message}`);

    return { lead_id: alvo.leadId, drive_view_link: viewLink };
  },
};
