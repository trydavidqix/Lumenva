export enum AutonomyLevel {
  SHADOW = 'SHADOW',
  ASSISTED = 'ASSISTED',
  AUTO_LOW_RISK = 'AUTO_LOW_RISK',
  AUTO_EXPANDED = 'AUTO_EXPANDED',
}

export interface AutonomyAuthorization {
  managementApproved: boolean;
  evalScore: number;
}

export class AutonomyController {
  private currentLevel: AutonomyLevel;

  constructor(initialLevel: AutonomyLevel = AutonomyLevel.SHADOW) {
    this.currentLevel = initialLevel;
  }

  public getLevel(): AutonomyLevel {
    return this.currentLevel;
  }

  /**
   * Enforces that an Agent's autonomy level CANNOT be increased dynamically 
   * based on memory or personality traits. It requires an explicit management 
   * authorization or eval score threshold.
   */
  public requestLevelIncrease(
    requestedLevel: AutonomyLevel,
    auth: AutonomyAuthorization,
    evalScoreThreshold: number = 80
  ): boolean {
    if (auth.managementApproved || auth.evalScore >= evalScoreThreshold) {
      this.currentLevel = requestedLevel;
      return true;
    }

    return false;
  }
}
