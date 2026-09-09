/**
 * Detecção de opt-out (STOP/PARAR/SAIR/UNSUBSCRIBE/CANCELAR) e bloqueio do
 * contato — compartilhado entre TODOS os canais inbound configurados para
 * WhatsApp. Antes cada canal tinha sua própria cópia (ou nenhuma): um dos
 * canais nunca checava STOP, então opt-out só funcionava em metade do
 * produto. Ver `docs/doctrine/restricao-de-canal.md`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { audit } from "@/lib/audit";

export const STOP_RX = /\b(STOP|PARAR|SAIR|UNSUBSCRIBE|CANCELAR)\b/i;

export async function blockContactIfStopKeyword(
  admin: SupabaseClient,
  params: {
    body: string | null | undefined;
    organizationId: string;
    contactId: string;
    requestId: string;
    now?: string;
  },
): Promise<void> {
  if (!params.body || !STOP_RX.test(params.body)) return;

  await admin
    .from("contacts")
    .update({
      is_blocked: true,
      blocked_reason: "stop_keyword",
      blocked_at: params.now ?? new Date().toISOString(),
    })
    .eq("id", params.contactId);

  await audit({
    action: "contact.blocked",
    organizationId: params.organizationId,
    resourceType: "contact",
    requestId: params.requestId,
    metadata: { reason: "stop_keyword", contact_id: params.contactId },
  });
}
