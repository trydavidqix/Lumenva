import type { RiskLevel, TaskComplexity } from './execution-port';

export interface RoutingObservation {
  model_id: string;
  task_type: string;
  complexity: TaskComplexity;
  risk: RiskLevel;
  success: boolean;
  reviewer_accepted: boolean;
  deterministic_passed: boolean;
  retries: number;
  latency_ms?: number;
  cost_usd?: number;
}

export interface ModelRoutingStats {
  model_id: string;
  samples: number;
  success_rate: number;
  reviewer_accept_rate: number;
  deterministic_pass_rate: number;
  avg_retries: number;
  avg_latency_ms?: number;
  avg_cost_usd?: number;
  validation_state: 'UNVALIDATED' | 'VALIDATING' | 'VALIDATED';
}

export class LearningRouter {
  private readonly observations: RoutingObservation[] = [];

  record(observation: RoutingObservation): void {
    this.observations.push(observation);
  }

  stats(modelId: string, minimumValidatedSamples = 30): ModelRoutingStats {
    const rows = this.observations.filter((row) => row.model_id === modelId);
    const samples = rows.length;
    const average = (values: number[]) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;

    return {
      model_id: modelId,
      samples,
      success_rate: samples ? rows.filter((row) => row.success).length / samples : 0,
      reviewer_accept_rate: samples ? rows.filter((row) => row.reviewer_accepted).length / samples : 0,
      deterministic_pass_rate: samples ? rows.filter((row) => row.deterministic_passed).length / samples : 0,
      avg_retries: samples ? rows.reduce((sum, row) => sum + row.retries, 0) / samples : 0,
      avg_latency_ms: average(rows.flatMap((row) => row.latency_ms === undefined ? [] : [row.latency_ms])),
      avg_cost_usd: average(rows.flatMap((row) => row.cost_usd === undefined ? [] : [row.cost_usd])),
      validation_state:
        samples === 0 ? 'UNVALIDATED' : samples < minimumValidatedSamples ? 'VALIDATING' : 'VALIDATED',
    };
  }

  historicalSuccess(): Record<string, number> {
    const ids = [...new Set(this.observations.map((observation) => observation.model_id))];
    return Object.fromEntries(ids.map((id) => [id, this.stats(id).success_rate]));
  }
}
