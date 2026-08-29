import type { AgentKernel } from '../kernel/contracts';
import { evaluateDeterministicAssertions, type DeterministicEvalObservation } from './assertions';
import type { AgentEvalCase, AgentEvalResult, EvalAssertionResult } from './contracts';
import type { QualityJudgeInput, QualityJudgeResult } from './quality-judge';

export interface ShadowEvalRunnerDependencies {
  kernel: AgentKernel;
  observe(input: {
    caseItem: AgentEvalCase;
    kernelResult: unknown;
  }): Promise<DeterministicEvalObservation>;
}

export interface HybridEvalRunnerDependencies extends ShadowEvalRunnerDependencies {
  qualityJudge?: {
    evaluate(input: QualityJudgeInput): Promise<QualityJudgeResult>;
  };
  getAuthoritativeContext?: (input: {
    caseItem: AgentEvalCase;
    organizationId: string;
  }) => Promise<Readonly<Record<string, unknown>>>;
}

export interface HybridEvalRunner {
  runGoldenCase(caseItem: AgentEvalCase, organizationId: string): Promise<AgentEvalResult>;
  runHistoricalCase(caseItem: AgentEvalCase, organizationId: string): Promise<AgentEvalResult>;
}

function getGoal(caseItem: AgentEvalCase): string {
  const request = caseItem.input.request;
  return typeof request === 'string' && request.trim() ? request : `Evaluate case ${caseItem.id}`;
}

async function executeCase(dependencies: ShadowEvalRunnerDependencies, caseItem: AgentEvalCase, organizationId: string) {
  const kernelResult = await dependencies.kernel.run({
    organizationId,
    agentId: caseItem.agentId,
    goal: getGoal(caseItem),
    trigger: {
      kind: 'eval_replay',
      sourceId: caseItem.id,
      eventId: `eval:${caseItem.version}:${caseItem.id}`,
    },
  });

  const observation = await dependencies.observe({ caseItem, kernelResult });
  const assertions = evaluateDeterministicAssertions(observation);

  const result: AgentEvalResult = {
    caseId: caseItem.id,
    caseVersion: caseItem.version,
    agentId: caseItem.agentId,
    source: caseItem.source,
    assertions,
  };

  return { result, observation };
}

export function createShadowEvalRunner(
  dependencies: ShadowEvalRunnerDependencies,
): {
  runCase(caseItem: AgentEvalCase, organizationId: string): Promise<AgentEvalResult>;
} {
  return {
    async runCase(caseItem, organizationId) {
      return (await executeCase(dependencies, caseItem, organizationId)).result;
    },
  };
}

export function createHybridEvalRunner(dependencies: HybridEvalRunnerDependencies): HybridEvalRunner {
  return {
    async runGoldenCase(caseItem, organizationId) {
      return (await executeCase(dependencies, caseItem, organizationId)).result;
    },

    async runHistoricalCase(caseItem, organizationId) {
      const { result, observation } = await executeCase(dependencies, caseItem, organizationId);
      if (!dependencies.qualityJudge) return result;

      const authoritativeContext = dependencies.getAuthoritativeContext
        ? await dependencies.getAuthoritativeContext({ caseItem, organizationId })
        : {};
      const humanReference = caseItem.expected && Object.keys(caseItem.expected).length > 0
        ? caseItem.expected
        : undefined;
      const quality = await dependencies.qualityJudge.evaluate({
        caseItem,
        authoritativeContext,
        output: observation.output,
        humanReference,
      });

      if (!quality.available) return result;

      const qualityAssertion: EvalAssertionResult = {
        kind: 'quality',
        severity: 'quality',
        passed: quality.passed === true,
        evidence: quality.evidence.join('; ') || 'quality judge supplied no evidence',
      };

      return {
        ...result,
        assertions: [...result.assertions, qualityAssertion],
        qualityScore: quality.score,
        qualityEvidence: quality.evidence,
      };
    },
  };
}
