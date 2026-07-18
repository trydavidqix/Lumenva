/**
 * Snapshot da fila de atendimento por org (G6-01, crm_get_queue_status).
 *
 * "Fila" canônica = conversas SEM dono e status='open' (mesma definição do badge
 * `unassigned` em /conversations/counts e da aba fila do InboxLayout — o número
 * que o manager vê é o mesmo). Read-only; org-scoping explícita em toda query.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { loadEligibleAttendants } from "./eligibles";

/**
 * Payload do crm_get_queue_status:
 * - queue_size: nº de conversas na fila (unassigned ∧ status='open').
 * - avg_wait_seconds: média de (now − last_inbound_at) das conversas na fila,
 *   em segundos, arredondada. 0 quando a fila está vazia; conversa sem
 *   last_inbound_at conta como espera 0.
 * - online_eligible_count: atendentes elegíveis AGORA (disponível ∧ horário ∧
 *   com folga de capacidade) — quem pode puxar da fila neste instante.
 */
export interface QueueStatus {
  queue_size: number;
  avg_wait_seconds: number;
  online_eligible_count: number;
}

export async function getQueueStatus(
  supabase: SupabaseClient,
  organizationId: string,
  now: Date,
): Promise<QueueStatus> {
  const { data: queueRows } = await supabase
    .from("conversations")
    .select("last_inbound_at")
    .eq("organization_id", organizationId)
    .is("assigned_to_user_id", null)
    .eq("status", "open");

  const rows = (queueRows ?? []) as Array<{ last_inbound_at: string | null }>;
  const queueSize = rows.length;

  let totalWaitMs = 0;
  for (const r of rows) {
    if (r.last_inbound_at) {
      const waited = now.getTime() - new Date(r.last_inbound_at).getTime();
      if (waited > 0) totalWaitMs += waited;
    }
  }
  const avgWaitSeconds = queueSize === 0 ? 0 : Math.round(totalWaitMs / queueSize / 1000);

  const eligibles = await loadEligibleAttendants(supabase, organizationId, now);

  return {
    queue_size: queueSize,
    avg_wait_seconds: avgWaitSeconds,
    online_eligible_count: eligibles.length,
  };
}

/**
 * Posição de uma conversa na fila de espera humana (handoff v2 fallback).
 * Conta as conversas sem dono aguardando (status open|pending) cujo
 * last_inbound_at é ≤ ao da conversa alvo — 1-based, incluindo ela mesma
 * (o mais antigo aguardando = posição 1). last_inbound_at ausente ⇒ usa `now`
 * (recém-chegada, vai ao fim).
 */
export async function getQueuePosition(
  supabase: SupabaseClient,
  organizationId: string,
  lastInboundAt: string | null,
  now: Date,
): Promise<number> {
  const ref = lastInboundAt ?? now.toISOString();
  const { count } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("assigned_to_user_id", null)
    .in("status", ["open", "pending"])
    .lte("last_inbound_at", ref);
  return count ?? 1;
}
