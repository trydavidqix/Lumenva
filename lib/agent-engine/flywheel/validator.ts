export interface CandidateMetrics {
  accuracy: number;
  policyCompliance: number;
  escalationCorrectness: number;
  failureRate: number;
  loopStopRate: number;
  costCents: number;
  latencyMs: number;
}

export interface CandidateValidationReport {
  passed: boolean;
  baseline: CandidateMetrics;
  candidate: CandidateMetrics;
  regressionCasesPassed: boolean;
  goldenCasesPassed: boolean;
  safetyPassed: boolean;
  shadowPassed: boolean | null;
  reasons: string[];
  evidenceRefs: string[];
}

export interface CandidateValidationPorts {
  runRegression(candidateRef: string): Promise<{ passed: boolean; evidenceRef: string }>;
  runGolden(candidateRef: string): Promise<{ passed: boolean; evidenceRef: string }>;
  evaluateMetrics(candidateRef: string, baseline: boolean): Promise<CandidateMetrics>;
  checkSafety(candidateRef: string): Promise<{ passed: boolean; evidenceRef: string }>;
  runShadow(candidateRef: string): Promise<{ passed: boolean; evidenceRef: string }>;
}

function metricReasons(baseline: CandidateMetrics, candidate: CandidateMetrics): string[] {
  const reasons: string[] = [];
  if (candidate.accuracy < baseline.accuracy) reasons.push('accuracy_regression');
  if (candidate.policyCompliance < baseline.policyCompliance) reasons.push('policy_compliance_regression');
  if (candidate.escalationCorrectness < baseline.escalationCorrectness) reasons.push('escalation_regression');
  if (candidate.failureRate > baseline.failureRate) reasons.push('failure_rate_regression');
  if (candidate.loopStopRate < baseline.loopStopRate) reasons.push('loop_stop_regression');
  return reasons;
}

export async function validateCandidate(
  candidateRef: string,
  ports: CandidateValidationPorts,
): Promise<CandidateValidationReport> {
  if (!candidateRef) throw new Error('flywheel_candidate_ref_invalid');

  const regression = await ports.runRegression(candidateRef);
  const golden = await ports.runGolden(candidateRef);
  const baseline = await ports.evaluateMetrics(candidateRef, true);
  const candidate = await ports.evaluateMetrics(candidateRef, false);
  const safety = await ports.checkSafety(candidateRef);

  const reasons = metricReasons(baseline, candidate);
  if (!regression.passed) reasons.push('regression_cases_failed');
  if (!golden.passed) reasons.push('golden_cases_failed');
  if (!safety.passed) reasons.push('safety_failed');

  let shadowPassed: boolean | null = null;
  let shadowRef: string | null = null;
  if (reasons.length === 0) {
    const shadow = await ports.runShadow(candidateRef);
    shadowPassed = shadow.passed;
    shadowRef = shadow.evidenceRef;
    if (!shadow.passed) reasons.push('shadow_failed');
  }

  return {
    passed: reasons.length === 0,
    baseline,
    candidate,
    regressionCasesPassed: regression.passed,
    goldenCasesPassed: golden.passed,
    safetyPassed: safety.passed,
    shadowPassed,
    reasons,
    evidenceRefs: [regression.evidenceRef, golden.evidenceRef, safety.evidenceRef, ...(shadowRef ? [shadowRef] : [])],
  };
}
