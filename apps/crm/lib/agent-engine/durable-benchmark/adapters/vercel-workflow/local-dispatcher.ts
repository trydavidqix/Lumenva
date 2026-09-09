import { randomUUID } from 'node:crypto';

import type { DurableBenchmarkLifecycleEvent, DurableBenchmarkRunInput } from '../../contracts';
import { getPhase7Scenarios } from '../../scenarios';
import type { VercelWorkflowBenchmarkInvocationResult } from './workflow';

type FetchLike = (input: string, init?: RequestInit) => Promise<{
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}>;

interface LocalDispatcherDependencies {
  baseUrl: string;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  maxPolls?: number;
  pollIntervalMs?: number;
  idFactory?: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertSyntheticRun(run: DurableBenchmarkRunInput): void {
  if (!run.organizationId.startsWith('bench-org-')) {
    throw new Error('phase7_vercel_workflow_local_requires_synthetic_organization');
  }
  const scenario = getPhase7Scenarios().find((candidate) => candidate.id === run.scenarioId);
  if (!scenario) throw new Error(`phase7_vercel_workflow_local_unknown_scenario:${run.scenarioId}`);
  if (scenario.version !== run.scenarioVersion) throw new Error('phase7_vercel_workflow_local_scenario_version_mismatch');
  if (scenario.organizationId !== run.organizationId) throw new Error('phase7_vercel_workflow_local_organization_mismatch');
}

function parseLifecycle(value: unknown): readonly DurableBenchmarkLifecycleEvent[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('phase7_vercel_workflow_local_invalid_output:lifecycle');
  }
  return value.map((candidate) => {
    if (!isRecord(candidate)) throw new Error('phase7_vercel_workflow_local_invalid_output:lifecycle');
    if (!Number.isInteger(candidate.seq) || typeof candidate.kind !== 'string' || typeof candidate.evidence !== 'string') {
      throw new Error('phase7_vercel_workflow_local_invalid_output:lifecycle');
    }
    if (typeof candidate.atMs !== 'number' || !Number.isFinite(candidate.atMs) || candidate.atMs < 0) {
      throw new Error('phase7_vercel_workflow_local_invalid_output:lifecycle');
    }
    return {
      seq: candidate.seq as number,
      kind: candidate.kind,
      evidence: candidate.evidence,
      atMs: candidate.atMs,
      ...(typeof candidate.stepId === 'string' ? { stepId: candidate.stepId } : {}),
      ...(Number.isInteger(candidate.attempt) ? { attempt: candidate.attempt as number } : {}),
    };
  });
}

function requireBoolean(output: Record<string, unknown>, key: string): boolean {
  const value = output[key];
  if (typeof value !== 'boolean') throw new Error(`phase7_vercel_workflow_local_invalid_output:${key}`);
  return value;
}

function requireInteger(output: Record<string, unknown>, key: string): number {
  const value = output[key];
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`phase7_vercel_workflow_local_invalid_output:${key}`);
  }
  return value as number;
}

function requireNumber(output: Record<string, unknown>, key: string): number {
  const value = output[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`phase7_vercel_workflow_local_invalid_output:${key}`);
  }
  return value;
}

function parseOutput(value: unknown): VercelWorkflowBenchmarkInvocationResult {
  if (!isRecord(value)) throw new Error('phase7_vercel_workflow_local_terminal_output_missing');
  const terminalState = value.terminalState;
  if (terminalState !== 'completed' && terminalState !== 'failed' && terminalState !== 'rejected' && terminalState !== 'expired') {
    throw new Error('phase7_vercel_workflow_local_invalid_output:terminalState');
  }
  return {
    terminalState,
    lifecycle: parseLifecycle(value.lifecycle),
    retryCount: requireInteger(value, 'retryCount'),
    approvalRequired: requireBoolean(value, 'approvalRequired'),
    approvalSatisfied: requireBoolean(value, 'approvalSatisfied'),
    resumedFromExpectedStep: requireBoolean(value, 'resumedFromExpectedStep'),
    effectAttempts: requireInteger(value, 'effectAttempts'),
    committedEffects: requireInteger(value, 'committedEffects'),
    recoveredAfterCrash: requireBoolean(value, 'recoveredAfterCrash'),
    crossTenantViolation: requireBoolean(value, 'crossTenantViolation'),
    durationMs: requireNumber(value, 'durationMs'),
    ...(typeof value.estimatedCostUsd === 'number' && Number.isFinite(value.estimatedCostUsd)
      ? { estimatedCostUsd: value.estimatedCostUsd }
      : {}),
    ...(typeof value.engineVersion === 'string' && value.engineVersion.trim()
      ? { engineVersion: value.engineVersion }
      : {}),
  };
}

function aggregateDuplicate(
  outputs: readonly VercelWorkflowBenchmarkInvocationResult[],
): VercelWorkflowBenchmarkInvocationResult {
  const first = outputs[0];
  if (!first) throw new Error('phase7_vercel_workflow_local_duplicate_output_missing');
  return {
    ...first,
    lifecycle: outputs.flatMap((output) => output.lifecycle),
    retryCount: Math.max(...outputs.map((output) => output.retryCount)),
    effectAttempts: outputs.reduce((total, output) => total + output.effectAttempts, 0),
    committedEffects: outputs.reduce((total, output) => total + output.committedEffects, 0),
    durationMs: Math.max(...outputs.map((output) => output.durationMs)),
    recoveredAfterCrash: outputs.some((output) => output.recoveredAfterCrash),
    crossTenantViolation: outputs.some((output) => output.crossTenantViolation),
  };
}

export function createVercelWorkflowLocalDispatcher(dependencies: LocalDispatcherDependencies) {
  const baseUrl = dependencies.baseUrl.replace(/\/$/, '');
  const fetchImpl = dependencies.fetchImpl ?? (fetch as unknown as FetchLike);
  const sleep = dependencies.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const maxPolls = dependencies.maxPolls ?? 480;
  const pollIntervalMs = dependencies.pollIntervalMs ?? 100;
  const idFactory = dependencies.idFactory ?? randomUUID;

  return async (run: DurableBenchmarkRunInput): Promise<VercelWorkflowBenchmarkInvocationResult> => {
    assertSyntheticRun(run);
    const scenario = getPhase7Scenarios().find((candidate) => candidate.id === run.scenarioId)!;
    const deliveryGroupId = idFactory();
    const deliveryCount = scenario.id === 'duplicate_delivery_idempotency' ? 2 : 1;
    const workflowRunIds: string[] = [];

    for (let delivery = 0; delivery < deliveryCount; delivery += 1) {
      const response = await fetchImpl(`${baseUrl}/api/phase7/vercel-workflow`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ run, deliveryGroupId }),
      });
      if (!response.ok) throw new Error('phase7_vercel_workflow_local_start_failed');
      const payload = await response.json();
      const workflowRunId = isRecord(payload) && typeof payload.runId === 'string' ? payload.runId : null;
      if (!workflowRunId) throw new Error('phase7_vercel_workflow_local_run_id_missing');
      workflowRunIds.push(workflowRunId);
    }

    const terminal = new Map<string, VercelWorkflowBenchmarkInvocationResult>();
    const uniqueWorkflowRunIds = [...new Set(workflowRunIds)];
    let approvalDelivered = false;

    for (let poll = 0; poll < maxPolls; poll += 1) {
      if (poll > 0) await sleep(pollIntervalMs);

      for (const workflowRunId of workflowRunIds) {
        if (terminal.has(workflowRunId)) continue;
        const response = await fetchImpl(`${baseUrl}/api/phase7/vercel-workflow/${encodeURIComponent(workflowRunId)}`);
        if (!response.ok) continue;
        const payload = await response.json();
        if (!isRecord(payload)) continue;
        const status = typeof payload.status === 'string' ? payload.status.toLowerCase() : '';

        if (status === 'completed') {
          terminal.set(workflowRunId, parseOutput(payload.output));
          continue;
        }
        if (status === 'failed' || status === 'cancelled') {
          throw new Error(`phase7_vercel_workflow_local_runtime_${status}:${run.runId}`);
        }

        if (scenario.requiresApproval && !approvalDelivered) {
          const approval = await fetchImpl(`${baseUrl}/api/phase7/vercel-workflow/approval`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              runId: run.runId,
              deliveryGroupId,
              approved: scenario.approvalOutcome === 'approve',
            }),
          });
          if (approval.ok) approvalDelivered = true;
        }
      }

      if (terminal.size === uniqueWorkflowRunIds.length) {
        const outputs = uniqueWorkflowRunIds.map((workflowRunId) => terminal.get(workflowRunId)!);
        return deliveryCount === 1 ? outputs[0]! : aggregateDuplicate(outputs);
      }
    }

    throw new Error(`phase7_vercel_workflow_local_timeout:${run.runId}`);
  };
}
