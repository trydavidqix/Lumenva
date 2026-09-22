import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTrace, startSpan, finishSpan, loadTrace } from '../src/traces.mjs';

const root = await mkdtemp(join(tmpdir(), 'mcg-trace-'));
try {
  const trace = await createTrace(root, { task_id: 'trace-task', source: 'test' });
  const parent = await startSpan(root, trace, { operation_type: 'context.compile', source: 'test' });
  const child = await startSpan(root, trace, { operation_type: 'tool.call', parent_span_id: parent.span_id, tool_name: 'test-tool', source: 'test' });
  await finishSpan(root, trace, child.span_id, { status: 'completed', output_chars: 12 });
  await finishSpan(root, trace, parent.span_id, { status: 'completed' });
  const loaded = await loadTrace(root, trace.trace_id);
  assert.equal(loaded.trace_id, trace.trace_id);
  assert.equal(loaded.spans.length, 2);
  assert.equal(loaded.spans.find(span => span.span_id === child.span_id).parent_span_id, parent.span_id);
  assert.equal(loaded.spans.find(span => span.span_id === child.span_id).status, 'completed');
} finally { await rm(root, { recursive: true, force: true }); }
console.log('trace tests: 1 passed');
