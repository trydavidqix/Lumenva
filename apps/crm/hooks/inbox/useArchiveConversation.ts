"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
export function useArchiveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversation_id, archived }: { conversation_id: string; archived: boolean }) => archived
      ? apiClient.post(`/api/v1/conversations/${conversation_id}/archive`, {})
      : apiClient.delete(`/api/v1/conversations/${conversation_id}/archive`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["conversations"] }); qc.invalidateQueries({ queryKey: ["conversation-counts"] }); },
  });
}
