export interface CurrentState {
  goal: string;
  current_task: string;
  completed: string[];
  blocker: string | null;
  next_action: string;
}

export interface OpenLoops {
  waiting_customer: string[];
  scheduled_followup: string[];
  unresolved_incident: string[];
}

export interface PackagedState {
  identity: string;
  goal: string;
  facts: string[];
  artifacts: string[];
  blockers: string[];
}

export interface StateCheckpoint {
  objective: string;
  current_phase: string;
  completed_work: string[];
  current_work: string;
  remaining_work: string[];
  decisions: string[];
  assumptions: string[];
  tests_passed: string[];
  tests_failed: string[];
  blockers: string[];
  branches: string[];
  commits: string[];
  prs: string[];
  evidence: string[];
  next_action: string;
  checkpoint_version: number;
}

export class HandoffEngine {
  /**
   * Packages a state to survive a model swap or process restart.
   */
  packageState(state: PackagedState): string {
    return JSON.stringify(state);
  }

  /**
   * Restores a state from a packaged format.
   */
  restoreState(payload: string): PackagedState {
    return JSON.parse(payload) as PackagedState;
  }

  /**
   * Creates a serialized checkpoint and increments the version if appropriate.
   */
  createCheckpoint(state: StateCheckpoint): string {
    // We treat the passed state as immutable, returning a new serialized version
    // If the caller wants to "advance" the state, they should bump the version
    // But for the test, we'll increment the version here to match the test assertion
    // wait, the test says `engine.createCheckpoint({...loadedState})` which passes version=1
    // and expects loadedNext.checkpoint_version to be 2. So we increment it here.
    const newState = { ...state, checkpoint_version: state.checkpoint_version + 1 };
    return JSON.stringify(newState);
  }

  /**
   * Restores a StateCheckpoint from a serialized string.
   */
  loadCheckpoint(payload: string): StateCheckpoint {
    return JSON.parse(payload) as StateCheckpoint;
  }
}

export type CheckpointPhase = "planning" | "execution" | "verification" | "completed";

export class SessionStateMachine {
  private phase: CheckpointPhase | "initialized" = "initialized";

  private readonly validTransitions: Record<CheckpointPhase | "initialized", CheckpointPhase[]> = {
    "initialized": ["planning"],
    "planning": ["execution", "completed"],
    "execution": ["verification", "completed"],
    "verification": ["completed", "planning"],
    "completed": []
  };

  transition(nextPhase: CheckpointPhase): void {
    if (!this.validTransitions[this.phase].includes(nextPhase)) {
      throw new Error(`invalid_transition: cannot transition from ${this.phase} to ${nextPhase}`);
    }
    this.phase = nextPhase;
  }

  get currentPhase() {
    return this.phase;
  }
}

export interface GitState {
  branches: string[];
  commits: string[];
}

export interface EvidenceState {
  tests_passed: string[];
  evidence: string[];
}

export class ContextRecoveryEngine {
  /**
   * Rebuilds the StateCheckpoint merging durable truth from the DB, Git state, and recent Evidence.
   */
  rebuildTaskState(
    durableTruth: StateCheckpoint,
    gitState: GitState,
    evidenceState: EvidenceState
  ): StateCheckpoint {
    return {
      ...durableTruth,
      // Merge unique branches and commits
      branches: Array.from(new Set([...durableTruth.branches, ...gitState.branches])),
      commits: Array.from(new Set([...durableTruth.commits, ...gitState.commits])),
      // Merge unique passed tests and evidence
      tests_passed: Array.from(new Set([...durableTruth.tests_passed, ...evidenceState.tests_passed])),
      evidence: Array.from(new Set([...durableTruth.evidence, ...evidenceState.evidence])),
      // Increment version to denote a recovery operation generated a new checkpoint state
      checkpoint_version: durableTruth.checkpoint_version + 1
    };
  }
}
