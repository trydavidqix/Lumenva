/**
 * SHADOW State: Pleasure, Arousal, Dominance
 * Explicitly marked as SHADOW - does not alter factual decisions yet.
 */
export interface ShadowPADState {
  pleasure: number; // -1.0 to 1.0
  arousal: number;  // -1.0 to 1.0
  dominance: number; // -1.0 to 1.0
  __shadow__: true;
}

/**
 * SHADOW State: OCC Emotions
 * Explicitly marked as SHADOW - does not alter factual decisions yet.
 */
export interface ShadowOCCEmotions {
  joy: number;
  distress: number;
  hope: number;
  fear: number;
  satisfaction: number;
  fearsConfirmed: number;
  relief: number;
  disappointment: number;
  happyFor: number;
  pity: number;
  resentment: number;
  gloating: number;
  pride: number;
  shame: number;
  admiration: number;
  reproach: number;
  gratification: number;
  remorse: number;
  gratitude: number;
  anger: number;
  love: number;
  hate: number;
  __shadow__: true;
}

/**
 * SHADOW State: Relationship Dynamics
 * Explicitly marked as SHADOW - does not alter factual decisions yet.
 */
export interface ShadowRelationshipDynamics {
  trustLevel: number; // 0.0 to 1.0
  decayRate: number; // How quickly trust/affect decays over time
  repairCount: number; // Number of successful relationship repair interactions
  __shadow__: true;
}
