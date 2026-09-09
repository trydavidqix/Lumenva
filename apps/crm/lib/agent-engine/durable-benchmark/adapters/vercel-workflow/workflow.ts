import type { DurableBenchmarkLifecycleEvent, DurableBenchmarkRunInput, DurableBenchmarkTerminalState } from '../../contracts';
import type { BenchmarkEffectStore } from '../../effect-store';

/**
 * Provider boundary for a real Workflow SDK benchmark run.
 *
 * The eventual provider implementation must execute orchestration in a
 * `"use workflow"` function and isolate effectful work in `"use step"`
 * functions. The SDK import is deliberately deferred until an approved
 * non-Preview executable runner can install and validate the dependency.
 */
export interface VercelWorkflowBenchmarkInvocationResult {
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

export interface VercelWorkflowBenchmarkInvocationPort {
  (input: {
    run: DurableBenchmarkRunInput;
    effectStore: BenchmarkEffectStore;
  }): Promise<VercelWorkflowBenchmarkInvocationResult>;
}
