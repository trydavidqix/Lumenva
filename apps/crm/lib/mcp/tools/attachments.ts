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
  /** O QUE o cliente disse que é o arquivo — obrigatório: a tool não roda sem
   *  isso, então o modelo é FORÇADO a perguntar antes de poder chamá-la. */
  description: z
    .string()
    .trim()
    .min(3, "pergunte ao cliente o que é o arquivo antes de chamar esta ferramenta")
    .max(200),
  /** Confirmação explícita de que o cliente autorizou guardar o arquivo na
   *  pasta dele. `false`/ausente é RECUSADO — não é opcional silencioso. */
  client_consented: z.literal(true, {
    message: "peça autorização ao cliente pra guardar o arquivo antes de chamar esta ferramenta",
  }),
};

export const crmUploadLeadAttachment: McpToolDefinition<typeof inputShape> = {
  name: "crm_upload_lead_attachment",
  description:
    "Sobe o arquivo/foto/vídeo/documento mais recente enviado pelo contato no WhatsApp para uma pasta " +
    "do Google Drive dedicada ao negócio (lead) aberto dele — a mesma pasta é reaproveitada em uploads " +
    "futuros do mesmo lead, nunca cria uma pasta nova por arquivo. SEQUÊNCIA OBRIGATÓRIA antes de " +
    "chamar: (1) pergunte ao cliente o que é o arquivo e descreva em `description`; (2) peça autorização " +
    "explícita pra guardar na pasta dele e só passe `client_consented: true` se ele disser sim. Chamar " +
    "sem ter feito as duas coisas é usar a ferramenta errado. Recusa se não houver anexo recente ou " +
    "negócio aberto único.",
  inputSchema: inputShape,
  category: "write",
  requiresRole: "ai_operator",
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
    const carimbo = (msg.created_at as string).slice(0, 16).replace("T", " ");
    const descricaoSegura = input.description
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .slice(0, 80);
    const fileName = `${carimbo} ${descricaoSegura}.${ext}`;
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
      reason: `Anexo autorizado pelo cliente salvo no Drive (${carimbo}): ${input.description} — ${viewLink}`,
      payload: {
        drive_file_id: file.id,
        message_id: msg.id,
        mime,
        description: input.description,
        client_consented: true,
      },
    });
    const { error: errInsert } = await ctx.supabase.from("crm_lead_activities").insert({
      ...row,
      payload: { ...row.payload, drive_web_view_link: viewLink },
    });
    if (errInsert) throw new Error(`erro ao registrar anexo no lead: ${errInsert.message}`);

    return { ok: true, lead_id: alvo.leadId, drive_file_id: file.id, drive_url: viewLink };
  },
};
