import { z } from 'zod';

export const autonomyStateSchema = z.enum(['draft', 'schedule', 'auto-publish']);
export type AutonomyState = z.infer<typeof autonomyStateSchema>;

export const autonomyEvidenceSchema = z.object({
  evalScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
});
export type AutonomyEvidence = z.infer<typeof autonomyEvidenceSchema>;

export interface AutonomyPolicy {
  minEvalScore: number;
  minConfidence: number;
}

export class AutonomyEscalator {
  private static readonly stateOrder: AutonomyState[] = ['draft', 'schedule', 'auto-publish'];

  private static readonly policies: Record<AutonomyState, AutonomyPolicy> = {
    'draft': { minEvalScore: 0, minConfidence: 0 },
    'schedule': { minEvalScore: 70, minConfidence: 0.7 },
    'auto-publish': { minEvalScore: 90, minConfidence: 0.9 },
  };

  /**
   * Asserts whether a transition to a target state is allowed based on evidence.
   * Enforces strict sequential transitions without bypassing.
   * Throws if evidence is insufficient or transition is invalid.
   */
  static assertTransition(
    currentState: AutonomyState,
    targetState: AutonomyState,
    evidence: AutonomyEvidence
  ): void {
    // Validate inputs
    autonomyStateSchema.parse(currentState);
    autonomyStateSchema.parse(targetState);
    autonomyEvidenceSchema.parse(evidence);

    const currentIndex = this.stateOrder.indexOf(currentState);
    const targetIndex = this.stateOrder.indexOf(targetState);

    // Always allow downgrades or staying in the same state
    if (targetIndex <= currentIndex) {
      return;
    }

    // Ensure no states are skipped (e.g., draft -> auto-publish directly is not allowed)
    if (targetIndex > currentIndex + 1) {
      throw new Error(`Escalation failed: Cannot bypass sequential state transitions. Must transition to '${this.stateOrder[currentIndex + 1]}' first.`);
    }

    const policy = this.policies[targetState];

    if (evidence.evalScore < policy.minEvalScore) {
      throw new Error(`Escalation to '${targetState}' denied: Insufficient eval score (${evidence.evalScore} < ${policy.minEvalScore}).`);
    }

    if (evidence.confidence < policy.minConfidence) {
      throw new Error(`Escalation to '${targetState}' denied: Insufficient confidence (${evidence.confidence} < ${policy.minConfidence}).`);
    }
  }

  /**
   * Safely calculates the maximum allowed state escalation for the immediate next step.
   * Returns the next state if evidence qualifies, otherwise returns the current state.
   */
  static escalate(currentState: AutonomyState, evidence: AutonomyEvidence): AutonomyState {
    const currentIndex = this.stateOrder.indexOf(currentState);
    
    if (currentIndex >= this.stateOrder.length - 1) {
      return currentState;
    }

    const nextState = this.stateOrder[currentIndex + 1];
    const policy = this.policies[nextState];

    if (evidence.evalScore >= policy.minEvalScore && evidence.confidence >= policy.minConfidence) {
      return nextState;
    }

    return currentState;
  }
}
