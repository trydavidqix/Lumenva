const clamp = value => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
const MIN_DATASET = 30;

export function efficiencyScore(metrics = {}) {
  const dataset_size = Number.isFinite(metrics.dataset_size) ? metrics.dataset_size : 0;
  if (dataset_size === 0) return { score: null, status: 'UNVALIDATED', dataset_size, minimum_dataset: MIN_DATASET, measurement_type: 'unavailable', source: 'paired evaluation aggregate', timestamp: new Date().toISOString() };
  if (dataset_size < MIN_DATASET) return { score: null, status: 'VALIDATING', dataset_size, minimum_dataset: MIN_DATASET, measurement_type: 'unavailable', source: 'paired evaluation aggregate', timestamp: new Date().toISOString() };

  const values = [
    metrics.real_token_saving,
    metrics.task_success,
    metrics.context_retention,
    metrics.evidence_grounding,
    Number.isFinite(metrics.hallucination_rate) ? 100 - metrics.hallucination_rate : null
  ];
  if (values.some(value => value == null)) return { score: null, status: 'UNVALIDATED', dataset_size, minimum_dataset: MIN_DATASET, measurement_type: 'unavailable', source: 'paired evaluation aggregate', timestamp: new Date().toISOString() };

  const base = values[0] * 0.3 + values[1] * 0.25 + values[2] * 0.2 + values[3] * 0.15 + values[4] * 0.1;
  const penalty = (metrics.retry_overhead || 0) * 0.05 + (metrics.latency_overhead || 0) * 0.05;
  return {
    score: Number(Math.max(0, Math.min(100, base - penalty)).toFixed(2)),
    status: 'VALIDATED',
    dataset_size,
    minimum_dataset: MIN_DATASET,
    formula: '0.30*saving + 0.25*success + 0.20*retention + 0.15*grounding + 0.10*(100-hallucination) - 0.05*retry_overhead - 0.05*latency_overhead',
    measurement_type: 'exact',
    source: 'paired evaluation aggregate',
    timestamp: new Date().toISOString()
  };
}

export function regressionWatch(baseline = {}, mcg = {}, { dataset_size = 0 } = {}) {
  if (!Number.isFinite(dataset_size) || dataset_size < MIN_DATASET) {
    return { status: 'UNVALIDATED', regressions: [], dataset_size: Number.isFinite(dataset_size) ? dataset_size : 0, minimum_dataset: MIN_DATASET, source: 'baseline vs MCG aggregate', measurement_type: 'unavailable', timestamp: new Date().toISOString() };
  }
  const regressions = [];
  if (Number.isFinite(baseline.task_success) && Number.isFinite(mcg.task_success) && mcg.task_success < baseline.task_success - 2) regressions.push('task_success');
  if (Number.isFinite(baseline.context_recall) && Number.isFinite(mcg.context_recall) && mcg.context_recall < baseline.context_recall) regressions.push('context_recall');
  if (Number.isFinite(baseline.hallucination_rate) && Number.isFinite(mcg.hallucination_rate) && mcg.hallucination_rate > baseline.hallucination_rate) regressions.push('hallucination_rate');
  if (Number.isFinite(baseline.total_tokens) && Number.isFinite(mcg.total_tokens) && mcg.total_tokens > baseline.total_tokens) regressions.push('total_tokens');
  return { status: regressions.length ? 'REGRESSION_DETECTED' : 'NO_REGRESSION', regressions, dataset_size, minimum_dataset: MIN_DATASET, source: 'baseline vs MCG aggregate', measurement_type: 'exact', timestamp: new Date().toISOString() };
}

export { clamp };
