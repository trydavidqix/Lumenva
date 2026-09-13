export const HERMES_EVIDENCE_STATES = [
  'PASS',
  'FAIL',
  'NOT_EXECUTED',
  'NOT_PROVEN',
  'BLOCKED',
] as const;

export type HermesEvidenceState = (typeof HERMES_EVIDENCE_STATES)[number];

const stateSet = new Set<string>(HERMES_EVIDENCE_STATES);

export function parseHermesEvidenceState(value: unknown): HermesEvidenceState {
  if (typeof value !== 'string' || !stateSet.has(value)) {
    throw new Error('hermes_evidence_state_invalid');
  }
  return value as HermesEvidenceState;
}

export function evidenceStatePasses(state: HermesEvidenceState): boolean {
  return state === 'PASS';
}

export function combineEvidenceStates(states: HermesEvidenceState[]): HermesEvidenceState {
  if (states.length === 0) return 'NOT_EXECUTED';
  if (states.includes('FAIL')) return 'FAIL';
  if (states.includes('BLOCKED')) return 'BLOCKED';
  if (states.includes('NOT_PROVEN')) return 'NOT_PROVEN';
  if (states.includes('NOT_EXECUTED')) return 'NOT_EXECUTED';
  return 'PASS';
}
