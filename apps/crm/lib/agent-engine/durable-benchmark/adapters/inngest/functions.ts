import type { DurableBenchmarkLifecycleEvent, DurableBenchmarkRunInput, DurableBenchmarkTerminalState } from '../../contracts';
import type { BenchmarkEffectStore } from '../../effect-store';

/**
 * Provider boundary for the real Inngest v4 benchmark function.
 *
 * The real implementation must use Inngest-native durable primitives such as
 * step.run() for retryable/checkpointed work and step.waitForEvent() for the
 * approval pause. This repository boundary intentionally contains no SDK import
 * until a dependency install and executable integration gate can be performed
 * through an approved runner.
 */
export interface InngestBenchmarkInvocationResult {
  terminalState: DurableBenchmarkTerminalState;
  lifecycle: readonly DurableBenchmarkLifecycleEvent[];
  retryCount: number;
  approvalRequired: boolean;
  approvalSatisfied: boolean;
  resumedFromExpectedStep: boolean;
  effectAttempts: number;
  committedEffects: number;
  recoveredAfterCrash: boolean;
  crossTenantViolation: boolean;
  durationMs: number;
  estimatedCostUsd?: number;
  engineVersion?: string;
}

export interface InngestBenchmarkInvocationPort {
  (input: {
    run: DurableBenchmarkRunInput;
    effectStore: BenchmarkEffectStore;
  }): Promise<InngestBenchmarkInvocationResult>;
}

export const INNGEST_PHASE_7_EVENT_NAMES = {
  run: 'agent-os/phase-7-benchmark.run',
  approval: 'agent-os/phase-7-benchmark.approval',
} as const;
