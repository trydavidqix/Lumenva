"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { EvolutionPayload } from "@/lib/ai/evolution/aggregate";

export interface EvolutionRange {
  from: string;
  to: string;
}

export interface Phase6ValidationMetrics {
  accuracy: number;
  policyCompliance: number;
  escalationCorrectness: number;
  failureRate: number;
  loopStopRate: number;
  costCents: number;
  latencyMs: number;
}

export interface Phase6ValidationSummary {
  passed: boolean;
  baseline: Phase6ValidationMetrics;
  candidate: Phase6ValidationMetrics;
  regressionCasesPassed: boolean;
  goldenCasesPassed: boolean;
  safetyPassed: boolean;
  shadowPassed: boolean | null;
  reasons: string[];
  evidenceRefs: string[];
}

export interface Phase6EvolutionQueueItem {
  id: string;
  type: string;
  target: string;
  content: string;
  proposed_at: string | null;
  scope: { organization_id: string; agent_id: string; capability_id: string };
  status: string;
  proposal_type: string;
  cluster_id: string;
  signal_refs: string[];
  candidate_ref: string | null;
  validation_ref: string | null;
  validation_summary: Phase6ValidationSummary | null;
  rollout_level: string | null;
  rollback_target_ref: string | null;
  rejection_reason: string | null;
}

export type EvolutionWithPhase6 = EvolutionPayload & { phase6_queue: Phase6EvolutionQueueItem[] };
export type Phase6ProposalDecision = "approve" | "reject" | "request_revision";

export function useEvolution(range?: EvolutionRange) {
  const qs = range ? `?from=${range.from}&to=${range.to}` : "";
  return useQuery({
    queryKey: ["evolution", range?.from ?? null, range?.to ?? null],
    queryFn: () =>
      apiClient
        .get<{ data: EvolutionWithPhase6 }>(`/api/v1/ai/evolution${qs}`)
        .then((r) => r.data),
  });
}

export function useReviewPhase6Proposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      agentId: string;
      proposalId: string;
      decision: Phase6ProposalDecision;
      reason: string;
    }) =>
      apiClient.post<{ data: { proposal_id?: string; status?: string; rollout_pending?: boolean } }>(
        `/api/v1/ai/agents/${input.agentId}/proposals/${input.proposalId}/apply`,
        { decision: input.decision, reason: input.reason },
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["evolution"] }),
  });
}
