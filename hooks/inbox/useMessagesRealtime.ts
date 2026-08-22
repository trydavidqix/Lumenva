"use client";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useCallback } from "react";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";
import { useRefetchDeSeguranca } from "@/hooks/realtime/useRefetchDeSeguranca";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import type { Message } from "@/lib/types/messaging";

interface MessagesResponse {
  data: Message[];
  meta?: { cursor?: string | null; has_more?: boolean };
}

/**
 * Assinatura pro detector de perda (`useRefetchDeSeguranca`): sensível a
 * exatamente o que o canal `messages` deveria trazer — quantidade e a
 * mensagem mais recente. Exportada pura (sem `d?.pages` inline no hook) para
 * ser testável sem montar QueryClient/Supabase mock.
 */
export function assinaturaMensagens(d: InfiniteData<MessagesResponse> | undefined): string {
  const todas = d?.pages.flatMap((p) => p.data) ?? [];
  let maior = "";
  for (const m of todas) if (m.created_at > maior) maior = m.created_at;
  return `${todas.length}:${maior}`;
}

export function useMessagesRealtime(conversationId: string | null) {
  const qc = useQueryClient();
  const queryKey = ["messages", conversationId] as const;

  const query = useInfiniteQuery({
    queryKey,
    enabled: !!conversationId,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!conversationId) {
        return { data: [], meta: { has_more: false, cursor: null } } as MessagesResponse;
      }
      const qs = new URLSearchParams();
      if (pageParam) qs.set("cursor", pageParam);
      qs.set("limit", "50");
      try {
        return await apiClient.get<MessagesResponse>(
          `/api/v1/conversations/${conversationId}/messages?${qs.toString()}`,
        );
      } catch (err) {
        showApiError(err);
        throw err;
      }
    },
    getNextPageParam: (last) =>
      last.meta?.has_more && last.meta.cursor ? last.meta.cursor : undefined,
  });

  const onChange = useCallback(() => {
    if (conversationId) qc.invalidateQueries({ queryKey: ["messages", conversationId] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }, [qc, conversationId]);

  const { ultimaEntrega } = useRealtimeChannel({
    name: conversationId ? `messages-${conversationId}` : "messages-disabled",
    postgresChanges: conversationId
      ? {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        }
      : undefined,
    onChange,
    enabled: !!conversationId,
  });

  // A REDE DE SEGURANÇA (mesmo padrão de hooks/kanban/useBoard.ts). Sem ela, um
  // canal que morre calado (ex.: socket assina anônimo por um 401 transitório
  // de auth) deixa a conversa congelada num passado que parece presente —
  // mensagem nova nunca aparece, e nem reabrir a conversa conserta sozinho.
  useRefetchDeSeguranca<InfiniteData<MessagesResponse>>({
    queryKey,
    assinatura: assinaturaMensagens,
    ultimaEntrega,
    enabled: !!conversationId,
  });

  return query;
}
