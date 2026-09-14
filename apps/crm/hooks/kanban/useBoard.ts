"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ehEcoLocal } from "@/lib/kanban/local-echo";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";
import { useRefetchDeSeguranca } from "@/hooks/realtime/useRefetchDeSeguranca";
import { apiClient } from "@/lib/api/client";
import type { BoardData } from "@/lib/kanban/types";

/**
 * Fetch board via API route (NOT direct supabase-js).
 *
 * Why: the auth cookie `sb-lumenva-auth` is httpOnly so the browser Supabase
 * client cannot read it — auth.uid() ends up null, RLS hides the pipeline,
 * and PostgREST returns PGRST116. Routing through /api/v1/pipelines/[id]/board
 * uses the server-side cookie reader, identical to every other authed query.
 */
async function fetchBoard(pipelineId: string): Promise<BoardData> {
  const res = await apiClient.get<{ data: BoardData }>(
    `/api/v1/pipelines/${pipelineId}/board`,
  );
  if (res && typeof res === "object" && "data" in res) {
    return (res as { data: BoardData }).data;
  }
  return res as unknown as BoardData;
}

const PULSE_MS = 1_200;

function idDoEvento(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { new?: { id?: unknown }; old?: { id?: unknown } };
  const id = p.new?.id ?? p.old?.id;
  return typeof id === "string" ? id : null;
}

export function useBoard(pipelineId: string | null) {
  const qc = useQueryClient();
  const queryKey = ["board", pipelineId] as const;
  const [pulses, setPulses] = useState<Map<string, number>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const query = useQuery({
    queryKey,
    queryFn: () => fetchBoard(pipelineId as string),
    enabled: !!pipelineId,
  });

  const onChange = useCallback(
    (payload: unknown) => {
      qc.invalidateQueries({ queryKey });

      const leadId = idDoEvento(payload);
      if (!leadId || ehEcoLocal(leadId)) return;

      setPulses((atual) => {
        const proximo = new Map(atual);
        proximo.set(leadId, (proximo.get(leadId) ?? 0) + 1);
        return proximo;
      });

      const anterior = timers.current.get(leadId);
      if (anterior) clearTimeout(anterior);
      timers.current.set(
        leadId,
        setTimeout(() => {
          timers.current.delete(leadId);
          setPulses((atual) => {
            if (!atual.has(leadId)) return atual;
            const proximo = new Map(atual);
            proximo.delete(leadId);
            return proximo;
          });
        }, PULSE_MS),
      );
    },
    [qc, queryKey],
  );

  const { status: realtimeStatus, ultimaEntrega } = useRealtimeChannel({
    name: pipelineId ? `kanban-${pipelineId}` : "kanban-disabled",
    postgresChanges: pipelineId
      ? {
          event: "*",
          schema: "public",
          table: "crm_leads",
          filter: `pipeline_id=eq.${pipelineId}`,
        }
      : undefined,
    onChange,
    enabled: !!pipelineId,
  });

  useEffect(() => {
    const pendentes = timers.current;
    return () => {
      for (const t of pendentes.values()) clearTimeout(t);
      pendentes.clear();
    };
  }, []);

  const seguranca = useRefetchDeSeguranca<BoardData>({
    queryKey,
    assinatura: (d) => {
      const leads = d?.leads ?? [];
      let maior = "";
      for (const l of leads) {
        const u = (l as { updated_at?: string }).updated_at ?? "";
        if (u > maior) maior = u;
      }
      return `${leads.length}:${maior}`;
    },
    ultimaEntrega,
    enabled: !!pipelineId,
  });

  return { ...query, pulses, realtimeStatus, seguranca };
}
