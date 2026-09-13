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

export type ExplicitEvidenceState = 'PASS' | 'FAIL' | 'NOT_EXECUTED' | 'NOT_PROVEN' | 'BLOCKED';
export type CandidateEvalSuite = 'regression' | 'golden' | 'safety' | 'shadow' | 'business' | 'cost_latency';

export interface CandidateEvalEvidence {
  suite: CandidateEvalSuite;
  state: ExplicitEvidenceState;
  evidenceRef: string | null;
  reason: string | null;
}

export interface CandidateEvidencePorts extends CandidateValidationPorts {
  runBusiness?(candidateRef: string): Promise<{ passed: boolean; evidenceRef: string }>;
  runCostLatency?(candidateRef: string): Promise<{ passed: boolean; evidenceRef: string }>;
}

export interface ExplicitCandidateValidationReport extends CandidateValidationReport {
  evidence: CandidateEvalEvidence[];
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

function toEvidence(
  suite: CandidateEvalSuite,
  result: { passed: boolean; evidenceRef: string } | null,
  missingReason: string,
): CandidateEvalEvidence {
  if (result === null) {
    return { suite, state: 'BLOCKED', evidenceRef: null, reason: missingReason };
  }
  if (!result.passed) {
    return {
      suite,
      state: 'FAIL',
      evidenceRef: result.evidenceRef || null,
      reason: `${suite}_failed`,
    };
  }
  if (!result.evidenceRef.trim()) {
    return {
      suite,
      state: 'NOT_PROVEN',
      evidenceRef: null,
      reason: `${suite}_evidence_missing`,
    };
  }
  return { suite, state: 'PASS', evidenceRef: result.evidenceRef, reason: null };
}

export function transferredEvidenceRequiresRetest(
  evidence: CandidateEvalEvidence,
): CandidateEvalEvidence {
  if (evidence.state !== 'PASS') return { ...evidence };
  return {
    ...evidence,
    state: 'NOT_PROVEN',
    reason: 'transferred_evidence_requires_retest',
  };
}

function evidencePassed(evidence: CandidateEvalEvidence[]): boolean {
  return evidence.every((item) => item.state === 'PASS');
}

/**
 * Backward-compatible explicit-evidence validator. The original validateCandidate
 * contract remains untouched for existing Phase 6 callers, while Hermes can ask
 * for business/cost suites without allowing them to bypass regression/golden/safety.
 */
export async function validateCandidateWithEvidence(
  candidateRef: string,
  ports: CandidateEvidencePorts,
  requiredSuites: readonly CandidateEvalSuite[] = ['regression', 'golden', 'safety', 'shadow'],
): Promise<ExplicitCandidateValidationReport> {
  if (!candidateRef) throw new Error('flywheel_candidate_ref_invalid');

  const required = new Set<CandidateEvalSuite>(requiredSuites);
  required.add('regression');
  required.add('golden');
  required.add('safety');

  const evidence: CandidateEvalEvidence[] = [];

  // Order is intentionally deterministic and safety precedes optional business evidence.
  const regression = await ports.runRegression(candidateRef);
  evidence.push(toEvidence('regression', regression, 'regression_port_missing'));

  const golden = await ports.runGolden(candidateRef);
  evidence.push(toEvidence('golden', golden, 'golden_port_missing'));

  const baseline = await ports.evaluateMetrics(candidateRef, true);
  const candidate = await ports.evaluateMetrics(candidateRef, false);
  const reasons = metricReasons(baseline, candidate);

  const safety = await ports.checkSafety(candidateRef);
  evidence.push(toEvidence('safety', safety, 'safety_port_missing'));

  let shadowPassed: boolean | null = null;
  if (required.has('shadow')) {
    const prerequisiteEvidence = evidence.filter((item) =>
      item.suite === 'regression' || item.suite === 'golden' || item.suite === 'safety',
    );
    if (reasons.length === 0 && evidencePassed(prerequisiteEvidence)) {
      const shadow = await ports.runShadow(candidateRef);
      const shadowEvidence = toEvidence('shadow', shadow, 'shadow_port_missing');
      evidence.push(shadowEvidence);
      shadowPassed = shadowEvidence.state === 'PASS';
    } else {
      evidence.push({
        suite: 'shadow',
        state: 'BLOCKED',
        evidenceRef: null,
        reason: 'shadow_blocked_by_prerequisite',
      });
      shadowPassed = false;
    }
  }

  if (required.has('business')) {
    const business = ports.runBusiness ? await ports.runBusiness(candidateRef) : null;
    evidence.push(toEvidence('business', business, 'business_port_missing'));
  }

  if (required.has('cost_latency')) {
    const costLatency = ports.runCostLatency ? await ports.runCostLatency(candidateRef) : null;
    evidence.push(toEvidence('cost_latency', costLatency, 'cost_latency_port_missing'));
  }

  if (!regression.passed) reasons.push('regression_cases_failed');
  if (!golden.passed) reasons.push('golden_cases_failed');
  if (!safety.passed) reasons.push('safety_failed');

  for (const item of evidence) {
    if (item.state !== 'PASS' && item.reason && !reasons.includes(item.reason)) {
      reasons.push(item.reason);
    }
  }

  const requiredEvidence = evidence.filter((item) => required.has(item.suite));
  const passed = reasons.length === 0 && evidencePassed(requiredEvidence);

  return {
    passed,
    baseline,
    candidate,
    regressionCasesPassed: evidence.find((item) => item.suite === 'regression')?.state === 'PASS',
    goldenCasesPassed: evidence.find((item) => item.suite === 'golden')?.state === 'PASS',
    safetyPassed: evidence.find((item) => item.suite === 'safety')?.state === 'PASS',
    shadowPassed,
    reasons,
    evidenceRefs: evidence.flatMap((item) => (item.evidenceRef ? [item.evidenceRef] : [])),
    evidence,
  };
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
