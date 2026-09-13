import type pg from "pg";

import {
  llmEdgeConfigFromEnv,
  runModelCall,
} from "@/lib/agent-engine/edge/llm/run-model-call";

import type {
  CouncilMemberAdapter,
  GovernedCouncilConfig,
} from "./council";
import { createGovernedCouncil } from "./council";
import {
  createRuntimeCouncilMember,
  type ScenarioCouncilModelCallInput,
  type ScenarioCouncilModelCallResult,
} from "./runtime-council-member";

export interface ScenarioRuntimeCouncilOptions {
  callModel(input: ScenarioCouncilModelCallInput): Promise<ScenarioCouncilModelCallResult>;
  maxRuntimeMs: number;
  maxTokens?: number;
  maxCostCents?: number;
}

function baselineParameters(input: Parameters<CouncilMemberAdapter["propose"]>[0]): Record<string, unknown> {
  return input.existingStrategies?.find((strategy) => strategy.isBaseline)?.parameters ?? {};
}

function fallbackMember(): CouncilMemberAdapter {
  return {
    id: "bounded-fallback",
    provider: "lumenva",
    model: "deterministic-scenario-scaffold@1",
    async propose(input) {
      const baseline = baselineParameters(input);
      return {
        candidates: [
          {
            name: "Alternativa conservadora",
            description: "Variação sintética de baixa intensidade para criar um ponto de comparação controlado.",
            parameters: { ...baseline, scenarioIntensity: 0.5 },
            assumptions: ["A intensidade sintética é apenas um eixo de teste e não representa probabilidade real."],
            risks: ["Sem evidência observada suficiente, a comparação serve apenas como hipótese exploratória."],
            evidenceRefs: [],
          },
          {
            name: "Alternativa completa",
            description: "Variação sintética de maior intensidade para ampliar o contraste entre estratégias.",
            parameters: { ...baseline, scenarioIntensity: 1 },
            assumptions: ["A intensidade sintética é um parâmetro experimental, não uma previsão calibrada."],
            risks: ["O resultado precisa de validação histórica ou experimento real antes de orientar ação."],
            evidenceRefs: [],
          },
        ].slice(0, Math.max(0, input.maxCandidates)),
        disagreements: input.evidence.length === 0 ? ["Não há evidência observada anexada ao cenário."] : [],
        synthesis: "Fallback determinístico usado apenas para manter o laboratório executável quando um membro de modelo não está disponível.",
        tokens: 0,
        costCents: 0,
      };
    },
    async challenge(input) {
      return {
        challenges: ["Validar se os parâmetros das estratégias correspondem à decisão real antes de qualquer ação."],
        missingEvidence: input.evidence.length === 0 ? ["Adicionar evidência observada ou histórica relevante à decisão."] : [],
        fragileAssumptions: ["Parâmetros sintéticos não são calibrados por padrão."],
        tokens: 0,
        costCents: 0,
      };
    },
    async review(input) {
      const top = input.evaluation.strategyRanking[0];
      return {
        summary: top
          ? `A estratégia ${top.strategyId} liderou a comparação sintética deste conjunto de runs.`
          : "A execução não produziu ranking sintético suficiente para comparação.",
        recommendation: "Usar o resultado apenas como apoio à decisão e validar a hipótese com evidência histórica ou experimento real controlado.",
        disagreements: [],
        criticalAssumptions: ["A simulação não é uma previsão calibrada."],
        nextValidationSteps: ["Revisar evidências, sensibilidade e estabilidade entre seeds antes de decidir."],
        tokens: 0,
        costCents: 0,
      };
    },
  };
}

export function createScenarioRuntimeCouncil(options: ScenarioRuntimeCouncilOptions) {
  const runtimeMember = createRuntimeCouncilMember({
    id: "org-default-model",
    callModel: options.callModel,
  });
  const config: GovernedCouncilConfig = {
    maxMembers: 2,
    maxRuntimeMs: Math.max(1_000, options.maxRuntimeMs),
    ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }),
    ...(options.maxCostCents === undefined ? {} : { maxCostCents: options.maxCostCents }),
  };
  return createGovernedCouncil([runtimeMember, fallbackMember()], config);
}

export function createScenarioRuntimeCouncilForDb(
  db: pg.Pool,
  options: Omit<ScenarioRuntimeCouncilOptions, "callModel">,
) {
  const llmConfig = llmEdgeConfigFromEnv({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    LLM_CACHE_TTL: process.env.LLM_CACHE_TTL,
  });

  return createScenarioRuntimeCouncil({
    ...options,
    callModel: async (input) => {
      const call = await runModelCall(db, llmConfig, {
        tenantId: input.organizationId,
        purpose: input.purpose,
        system: input.system,
        messages: [{ role: "user", content: input.prompt }],
        maxSteps: 1,
      });
      return {
        text: call.result.text,
        provider: call.provider,
        model: call.model,
        tokens: call.usage.inputTokens + call.usage.outputTokens,
        costCents: call.costCents ?? 0,
      };
    },
  });
}
