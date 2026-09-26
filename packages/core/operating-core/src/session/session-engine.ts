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
}
