"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";

export interface MergeQueueItem {
  id: string;
  organization_id: string;
  candidates: string[];
  reason: string;
  status: string;
  created_at: string;
}

export const mergeQueueQueryKey = ["customer360", "merge-queue"] as const;

export function useMergeQueue(options: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const enabled = options.enabled ?? true;
  const query = useQuery({
    queryKey: mergeQueueQueryKey,
    queryFn: () => apiClient.get<{ data: MergeQueueItem[] }>("/api/v1/merge_queue"),
    staleTime: 15_000,
    enabled,
  });
  const onChange = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: mergeQueueQueryKey });
  }, [queryClient]);
  useRealtimeChannel({
    name: "customer360-merge-queue",
    postgresChanges: enabled
      ? { event: "*", schema: "public", table: "merge_queue" }
      : undefined,
    onChange,
    enabled,
  });
  return query;
}

export function useResolveMerge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, primary_id, loser_ids }: { id: string; action: "merge" | "discard"; primary_id?: string; loser_ids?: string[] }) =>
      apiClient.post<{ data: { id: string; action: string } }>(`/api/v1/merge_queue/${id}/resolve`, { action, primary_id, loser_ids }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: mergeQueueQueryKey });
      toast.success(variables.action === "merge" ? "Contactos mesclados." : "Item descartado.");
    },
    onError: showApiError,
  });
}
