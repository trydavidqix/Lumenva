import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contextMetricsFromEvents } from '../src/dashboard.mjs';

test('context metrics use weighted compression and task-based coverage', () => {
  const events = [
    { task_id: 'a', operation: 'context.compile', input_chars: 100, output_chars: 0 },
    { task_id: 'b', operation: 'context.compile', input_chars: 900, output_chars: 450 },
    { task_id: 'c', operation: 'ingest', input_chars: 20, output_chars: 10 }
  ];
  const metrics = contextMetricsFromEvents(events);
  assert.equal(metrics.compression_ratio, 55);
  assert.equal(metrics.mcg_coverage, 66.67);
  assert.equal(metrics.eligible_tasks, 3);
  assert.equal(metrics.covered_tasks, 2);
  assert.equal(metrics.estimated_context_savings.saved_chars, 550);
  assert.equal(metrics.estimated_context_savings.estimated_tokens_avoided, 138);
  assert.equal(metrics.estimated_context_savings.measurement_type, 'estimated');
});
