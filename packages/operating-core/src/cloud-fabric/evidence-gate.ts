import type { ExecutionResult, RiskLevel } from './execution-port';

export interface EvidenceGateResult {
  passed: boolean;
  reasons: string[];
}

export function evidenceGate(result: ExecutionResult, risk: RiskLevel): EvidenceGateResult {
  const reasons: string[] = [];
  if (!result.evidence.trim()) reasons.push('evidence_missing');
  if (result.status !== 'success') reasons.push('execution_not_successful');
  if (risk !== 'R0' && result.tests.length === 0) reasons.push('tests_missing');
  if (result.tests.some((test) => !test.passed)) reasons.push('tests_failed');
  if ((risk === 'R3' || risk === 'R4') && (result.risks ?? []).length > 0) reasons.push('unresolved_risks');
  return { passed: reasons.length === 0, reasons };
}
