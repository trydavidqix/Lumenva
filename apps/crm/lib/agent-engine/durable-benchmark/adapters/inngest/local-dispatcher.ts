import type { DurableBenchmarkLifecycleEvent } from '../../contracts';
import { getPhase7Scenarios } from '../../scenarios';
import type { InngestBatchDispatchInput, InngestBatchDispatchResult } from './batch-runner';
import { INNGEST_PHASE_7_EVENT_NAMES } from './functions';

type FetchLike = (input: string, init?: RequestInit) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

interface LocalDispatcherDependencies {
  baseUrl: string;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  maxPolls?: number;
  pollIntervalMs?: number;
}

function assertSyntheticOrganization(organizationId: string): void {
  if (!organizationId.startsWith('bench-org-') && !organizationId.startsWith('synthetic-')) {
    throw new Error('phase7_inngest_local_dispatch_requires_synthetic_organization');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMaybeJsonRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function unwrapRunOutput(value: unknown): Record<string, unknown> | null {
  let current = parseMaybeJsonRecord(value);
  for (let depth = 0; current && depth < 4; depth += 1) {
    if ('terminalState' in current || 'lifecycle' in current) return current;
    const nested = current.output ?? current.result ?? current.data;
    const parsed = parseMaybeJsonRecord(nested);
    if (!parsed || parsed === current) return current;
    current = parsed;
  }
  return current;
}

function parseLifecycle(value: unknown): readonly DurableBenchmarkLifecycleEvent[] | null {
  if (!Array.isArray(value)) return null;
  const events: DurableBenchmarkLifecycleEvent[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) return null;
    if (!Number.isInteger(candidate.seq) || typeof candidate.kind !== 'string' || typeof candidate.evidence !== 'string') {
      return null;
    }
    if (typeof candidate.atMs !== 'number' || !Number.isFinite(candidate.atMs)) return null;
    events.push({
      seq: candidate.seq as number,
      kind: candidate.kind,
      evidence: candidate.evidence,
      atMs: candidate.atMs,
      ...(typeof candidate.stepId === 'string' ? { stepId: candidate.stepId } : {}),
      ...(Number.isInteger(candidate.attempt) ? { attempt: candidate.attempt as number } : {}),
    });
  }
  return events;
}

function requireBoolean(output: Record<string, unknown>, key: string): boolean {
  const value = output[key];
  if (typeof value !== 'boolean') throw new Error(`phase7_inngest_local_invalid_output:${key}`);
  return value;
}

function requireNonNegativeInteger(output: Record<string, unknown>, key: string): number {
  const value = output[key];
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`phase7_inngest_local_invalid_output:${key}`);
  }
  return value as number;
}

function requireNonNegativeNumber(output: Record<string, unknown>, key: string): number {
  const value = output[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`phase7_inngest_local_invalid_output:${key}`);
  }
  return value;
}

function extractFirstRun(payload: unknown): Record<string, unknown> | null {
  const run = Array.isArray(payload)
    ? payload[0]
    : isRecord(payload) && Array.isArray(payload.data)
      ? payload.data[0]
      : payload;
  return isRecord(run) ? run : null;
}

function parseTerminalResult(run: Record<string, unknown>, input: InngestBatchDispatchInput): InngestBatchDispatchResult | null {
  const status = typeof run.status === 'string' ? run.status.toLowerCase() : '';
  if (status !== 'completed' && status !== 'failed' && status !== 'cancelled') return null;

  const output = unwrapRunOutput(run.output ?? run.result ?? run.data);
  if (!output) throw new Error(`phase7_inngest_local_terminal_output_missing:${input.runId}`);

  const terminalState = output.terminalState;
  if (terminalState !== 'completed' && terminalState !== 'failed' && terminalState !== 'rejected' && terminalState !== 'expired') {
    throw new Error('phase7_inngest_local_invalid_output:terminalState');
  }
  const lifecycle = parseLifecycle(output.lifecycle);
  if (!lifecycle || lifecycle.length === 0) throw new Error('phase7_inngest_local_invalid_output:lifecycle');

  return {
    terminalState,
    lifecycle,
    retryCount: requireNonNegativeInteger(output, 'retryCount'),
    approvalRequired: requireBoolean(output, 'approvalRequired'),
    approvalSatisfied: requireBoolean(output, 'approvalSatisfied'),
    resumedFromExpectedStep: requireBoolean(output, 'resumedFromExpectedStep'),
    effectAttempts: requireNonNegativeInteger(output, 'effectAttempts'),
    committedEffects: requireNonNegativeInteger(output, 'committedEffects'),
    recoveredAfterCrash: requireBoolean(output, 'recoveredAfterCrash'),
    crossTenantViolation: requireBoolean(output, 'crossTenantViolation'),
    durationMs: requireNonNegativeNumber(output, 'durationMs'),
    ...(typeof output.estimatedCostUsd === 'number' && Number.isFinite(output.estimatedCostUsd)
      ? { estimatedCostUsd: output.estimatedCostUsd }
      : {}),
    ...(typeof output.engineVersion === 'string' && output.engineVersion.trim()
      ? { engineVersion: output.engineVersion }
      : {}),
  };
}

export function createInngestLocalDispatcher(dependencies: LocalDispatcherDependencies) {
  const fetchImpl = dependencies.fetchImpl ?? (fetch as unknown as FetchLike);
  const sleep = dependencies.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const maxPolls = dependencies.maxPolls ?? 240;
  const pollIntervalMs = dependencies.pollIntervalMs ?? 250;
  const baseUrl = dependencies.baseUrl.replace(/\/$/, '');

  return async (input: InngestBatchDispatchInput): Promise<InngestBatchDispatchResult> => {
    assertSyntheticOrganization(input.organizationId);
    const scenario = getPhase7Scenarios().find((candidate) => candidate.id === input.scenarioId);
    if (!scenario) throw new Error(`phase7_inngest_local_unknown_scenario:${input.scenarioId}`);
    if (scenario.version !== input.scenarioVersion) throw new Error('phase7_inngest_local_scenario_version_mismatch');
    if (scenario.organizationId !== input.organizationId) throw new Error('phase7_inngest_local_organization_mismatch');

    const deterministicEventId = `phase7-${input.runId}`;
    const eventBody = {
      id: deterministicEventId,
      name: INNGEST_PHASE_7_EVENT_NAMES.run,
      data: {
        runId: input.runId,
        scenarioId: input.scenarioId,
        scenarioVersion: input.scenarioVersion,
        organizationId: input.organizationId,
        profile: input.profile,
        attempt: input.attempt,
      },
    };

    const response = await fetchImpl(`${baseUrl}/e/phase7-local-key`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(eventBody),
    });
    if (!response.ok) throw new Error('phase7_inngest_local_event_dispatch_failed');

    const eventPayload = await response.json();
    const eventId = isRecord(eventPayload) && Array.isArray(eventPayload.ids) && typeof eventPayload.ids[0] === 'string'
      ? eventPayload.ids[0]
      : null;
    if (!eventId) throw new Error('phase7_inngest_local_event_id_missing');

    const eventIds = [eventId];

    if (scenario.id === 'duplicate_delivery_idempotency') {
      const duplicateResponse = await fetchImpl(`${baseUrl}/e/phase7-local-key`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...eventBody,
          id: `${deterministicEventId}-duplicate`,
        }),
      });
      if (!duplicateResponse.ok) throw new Error('phase7_inngest_local_duplicate_dispatch_failed');
      const duplicatePayload = await duplicateResponse.json();
      const duplicateEventId = isRecord(duplicatePayload) && Array.isArray(duplicatePayload.ids) && typeof duplicatePayload.ids[0] === 'string'
        ? duplicatePayload.ids[0]
        : null;
      if (!duplicateEventId) throw new Error('phase7_inngest_local_duplicate_event_id_missing');
      eventIds.push(duplicateEventId);
    }

    let approvalDispatchCount = 0;
    const dispatchApproval = async () => {
      approvalDispatchCount += 1;
      const approvalResponse = await fetchImpl(`${baseUrl}/e/phase7-local-key`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: `phase7-approval-${input.runId}-${approvalDispatchCount}`,
          name: INNGEST_PHASE_7_EVENT_NAMES.approval,
          data: {
            runId: input.runId,
            approved: scenario.approvalOutcome === 'approve',
          },
        }),
      });
      if (!approvalResponse.ok) throw new Error('phase7_inngest_local_approval_dispatch_failed');
    };

    for (let poll = 0; poll < maxPolls; poll += 1) {
      if (poll > 0) await sleep(pollIntervalMs);

      let observedNonTerminalRun = false;
      for (const candidateEventId of eventIds) {
        const runResponse = await fetchImpl(
          `${baseUrl}/api/v2/events/${encodeURIComponent(candidateEventId)}/runs?includeOutput=true`,
        );
        if (!runResponse.ok) continue;

        const payload = await runResponse.json();
        const run = extractFirstRun(payload);
        if (!run) continue;

        const result = parseTerminalResult(run, input);
        if (result) return result;
        observedNonTerminalRun = true;
      }

      if (scenario.requiresApproval && observedNonTerminalRun) {
        await dispatchApproval();
      }
    }

    throw new Error(`phase7_inngest_local_run_timeout:${input.runId}`);
  };
}
