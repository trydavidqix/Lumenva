import type { HermesOutcomeRecord } from './outcome-ledger';
import type { HermesRoutingOutcome } from './routing-metrics';
import { aggregateRoutingMetrics } from './routing-metrics';
import type { ResearchExperimentRecord } from './research-memory';

export interface HermesMetaResearchReport {
  experimentCount: number;
  keepRate: number;
  crashRate: number;
  meanScore: number;
  meanKpiDelta: number;
  meanCostCents: number;
  meanLatencyMs: number;
  routing: ReturnType<typeof aggregateRoutingMetrics>;
  strategyRanking: Array<{ strategy: string; experiments: number; meanScore: number; keepRate: number }>;
  recurringFailures: Array<{ signature: string; count: number }>;
  recommendations: string[];
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildMetaResearchReport(input: {
  experiments: ResearchExperimentRecord[];
  outcomes: HermesOutcomeRecord[];
  routingOutcomes: HermesRoutingOutcome[];
}): HermesMetaResearchReport {
  const { experiments, outcomes, routingOutcomes } = input;
  const strategy = new Map<string, ResearchExperimentRecord[]>();
  const failures = new Map<string, number>();

  for (const experiment of experiments) {
    const rows = strategy.get(experiment.strategy) ?? [];
    rows.push(experiment);
    strategy.set(experiment.strategy, rows);
    if (experiment.status === 'crash' || experiment.status === 'discard') {
      const signature = String(experiment.metadata.failureSignature ?? `${experiment.subjectKind}:${experiment.status}`);
      failures.set(signature, (failures.get(signature) ?? 0) + 1);
    }
  }

  const strategyRanking = [...strategy.entries()]
    .map(([name, rows]) => ({
      strategy: name,
      experiments: rows.length,
      meanScore: mean(rows.flatMap((row) => (typeof row.score === 'number' ? [row.score] : []))),
      keepRate: rows.filter((row) => row.status === 'keep').length / rows.length,
    }))
    .sort((a, b) => b.meanScore - a.meanScore || b.keepRate - a.keepRate || a.strategy.localeCompare(b.strategy));

  const kpiDeltas = outcomes.flatMap((row) =>
    row.kpiBaseline !== null && row.kpiObserved !== null ? [row.kpiObserved - row.kpiBaseline] : [],
  );
  const costs = outcomes.flatMap((row) => (row.costCents === null ? [] : [row.costCents]));
  const latency = outcomes.flatMap((row) => (row.latencyMs === null ? [] : [row.latencyMs]));

  const recommendations: string[] = [];
  if (strategyRanking.length > 1) {
    recommendations.push(`retest_strategy:${strategyRanking[0]?.strategy ?? 'unknown'}`);
  }
  const routing = aggregateRoutingMetrics(routingOutcomes);
  if (routing.falsePassCount > 0) recommendations.push('tighten_evidence_gate');
  if (routing.averageExtraWorkers > 0.5) recommendations.push('reduce_execution_shape');

  return {
    experimentCount: experiments.length,
    keepRate: experiments.length === 0 ? 0 : experiments.filter((row) => row.status === 'keep').length / experiments.length,
    crashRate: experiments.length === 0 ? 0 : experiments.filter((row) => row.status === 'crash').length / experiments.length,
    meanScore: mean(experiments.flatMap((row) => (row.score === null ? [] : [row.score]))),
    meanKpiDelta: mean(kpiDeltas),
    meanCostCents: mean(costs),
    meanLatencyMs: mean(latency),
    routing,
    strategyRanking,
    recurringFailures: [...failures.entries()]
      .map(([signature, count]) => ({ signature, count }))
      .sort((a, b) => b.count - a.count || a.signature.localeCompare(b.signature)),
    recommendations,
  };
}
