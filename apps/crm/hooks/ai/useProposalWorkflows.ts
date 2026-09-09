/**
 * useProposalWorkflows — Hook for proposal workflow run management.
 *
 * Lists, fetches, and submits approval decisions for workflow runs.
 * Handles auth, org scope, and error states.
 */

import { useCallback, useEffect, useState } from 'react';
import type { z } from 'zod';

export interface ProposalWorkflowRun {
  run_id: string;
  status: 'drafting' | 'awaiting_approval' | 'approved' | 'rejected' | 'sending' | 'completed' | 'failed' | 'cancelled' | 'shadow';
  contact_id: string;
  conversation_id: string | null;
  lead_id: string | null;
  draft_payload: Record<string, unknown> | null;
  decision_payload: Record<string, unknown> | null;
  sent_message_id: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UseProposalWorkflowsResult {
  runs: ProposalWorkflowRun[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  submitDecision: (runId: string, decision: 'approve' | 'reject' | 'edit', reason?: string, body?: string) => Promise<void>;
  fetchRunDetail: (runId: string) => Promise<ProposalWorkflowRun | null>;
}

export function useProposalWorkflows(): UseProposalWorkflowsResult {
  const [runs, setRuns] = useState<ProposalWorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/ai/workflows/proposals', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch runs: ${res.status}`);
      }

      const json = (await res.json()) as { data?: ProposalWorkflowRun[] };
      setRuns(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRunDetail = useCallback(async (runId: string): Promise<ProposalWorkflowRun | null> => {
    try {
      const res = await fetch(`/api/v1/ai/workflows/proposals/${runId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Failed to fetch run: ${res.status}`);
      }

      const json = (await res.json()) as { data?: ProposalWorkflowRun };
      return json.data || null;
    } catch (err) {
      console.error('Failed to fetch run detail:', err);
      return null;
    }
  }, []);

  const submitDecision = useCallback(
    async (runId: string, decision: 'approve' | 'reject' | 'edit', reason?: string, body?: string) => {
      try {
        setError(null);
        const res = await fetch(`/api/v1/ai/workflows/proposals/${runId}/decision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            reason,
            body,
          }),
        });

        if (!res.ok) {
          throw new Error(`Decision failed: ${res.status}`);
        }

        await refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      }
    },
    [refetch],
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    runs,
    loading,
    error,
    refetch,
    submitDecision,
    fetchRunDetail,
  };
}
