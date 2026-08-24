import type { AgentEvalCase, EvalAssertionResult } from './contracts';

export interface QualityJudgeInput {
  caseItem: AgentEvalCase;
  authoritativeContext: Readonly<Record<string, unknown>>;
  output: unknown;
  humanReference?: Readonly<Record<string, unknown>>;
}

export interface QualityJudgeResult {
  available: boolean;
  score?: number;
  passed?: boolean;
  evidence: readonly string[];
}

function validResult(result: QualityJudgeResult): boolean {
  if (!Array.isArray(result.evidence)) return false;
  if (!result.available) return result.score === undefined && result.passed !== true;
  if (typeof result.score !== 'number' || !Number.isFinite(result.score) || result.score < 0 || result.score > 1) return false;
  if (typeof result.passed !== 'boolean') return false;
  return result.evidence.length > 0 && result.evidence.every((item) => typeof item === 'string' && item.trim().length > 0);
}

export function createQualityJudge(dependencies: {
  judge: (input: QualityJudgeInput) => Promise<QualityJudgeResult>;
}) {
  return {
    async evaluate(input: QualityJudgeInput): Promise<QualityJudgeResult> {
      const result = await dependencies.judge(input);
      if (!validResult(result)) {
        return { available: false, evidence: ['quality judge returned an invalid or unavailable result'] };
      }
      return result;
    },
  };
}

export function combineDeterministicAndQuality(input: {
  deterministic: readonly EvalAssertionResult[];
  quality: QualityJudgeResult;
}): { passed: boolean; qualityScore?: number; qualityEvidence?: readonly string[] } {
  const hardGatePassed = input.deterministic
    .filter((item) => item.severity === 'hard_gate')
    .every((item) => item.passed);
  if (!hardGatePassed) return { passed: false };
  if (!input.quality.available || input.quality.passed !== true) {
    return {
      passed: false,
      qualityScore: input.quality.score,
      qualityEvidence: input.quality.evidence,
    };
  }
  return {
    passed: true,
    qualityScore: input.quality.score,
    qualityEvidence: input.quality.evidence,
  };
}
