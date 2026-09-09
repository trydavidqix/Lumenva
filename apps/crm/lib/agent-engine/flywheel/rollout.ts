import type { AgentAutonomyLevel } from '../policies/engine';

export interface LearningRolloutState {
  proposalId: string;
  candidateRef: string;
  previousLevel: AgentAutonomyLevel;
  currentStage: 'shadow' | 'draft' | 'restored_previous_level' | 'rolled_back';
  rollbackTargetRef: string;
}

export interface LearningRolloutPorts {
  assertRestoreAllowed(previousLevel: AgentAutonomyLevel): Promise<void> | void;
  setCandidateLevel(candidateRef: string, level: 'shadow' | 'draft'): Promise<void>;
  restorePreviousLevel(candidateRef: string, previousLevel: AgentAutonomyLevel): Promise<void>;
  rollback(candidateRef: string, rollbackTargetRef: string): Promise<void>;
}

export interface StartLearningRolloutInput {
  proposalId: string;
  candidateRef: string;
  previousLevel: AgentAutonomyLevel;
  rollbackTargetRef: string;
  proposalStatus: string;
  runtimeAffecting: boolean;
}

export async function startLearningRollout(
  input: StartLearningRolloutInput,
  ports: LearningRolloutPorts,
): Promise<LearningRolloutState> {
  if (input.proposalStatus !== 'approved') throw new Error('flywheel_rollout_not_approved');
  if (!input.proposalId || !input.candidateRef || !input.previousLevel) throw new Error('flywheel_rollout_invalid');

  await ports.assertRestoreAllowed(input.previousLevel);

  if (!input.runtimeAffecting) {
    return {
      proposalId: input.proposalId,
      candidateRef: input.candidateRef,
      previousLevel: input.previousLevel,
      currentStage: 'restored_previous_level',
      rollbackTargetRef: input.rollbackTargetRef,
    };
  }

  await ports.setCandidateLevel(input.candidateRef, 'shadow');
  return {
    proposalId: input.proposalId,
    candidateRef: input.candidateRef,
    previousLevel: input.previousLevel,
    currentStage: 'shadow',
    rollbackTargetRef: input.rollbackTargetRef,
  };
}

export async function advanceLearningRollout(
  state: LearningRolloutState,
  action: 'draft' | 'restore' | 'rollback',
  ports: LearningRolloutPorts,
): Promise<LearningRolloutState> {
  if (action === 'rollback') {
    await ports.rollback(state.candidateRef, state.rollbackTargetRef);
    return { ...state, currentStage: 'rolled_back' };
  }

  if (state.currentStage === 'shadow' && action === 'draft') {
    await ports.setCandidateLevel(state.candidateRef, 'draft');
    return { ...state, currentStage: 'draft' };
  }

  if (state.currentStage === 'draft' && action === 'restore') {
    await ports.assertRestoreAllowed(state.previousLevel);
    await ports.restorePreviousLevel(state.candidateRef, state.previousLevel);
    return { ...state, currentStage: 'restored_previous_level' };
  }

  throw new Error('flywheel_rollout_transition_invalid');
}
