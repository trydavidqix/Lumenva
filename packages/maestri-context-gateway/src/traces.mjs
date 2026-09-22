import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const safe = value => typeof value === 'string' && value.length <= 200 ? value : null;
const number = value => Number.isFinite(value) ? value : null;

async function traceDir(root) { const dir = join(root, 'state', 'telemetry', 'traces'); await mkdir(dir, { recursive: true, mode: 0o700 }); return dir; }
async function append(root, traceId, row) { await appendFile(join(await traceDir(root), `${traceId}.jsonl`), `${JSON.stringify(row)}\n`, { mode: 0o600 }); return row; }

export async function createTrace(root, input = {}) {
  const timestamp = new Date().toISOString(); const trace_id = safe(input.trace_id) || `trace-${randomUUID()}`;
  const row = { trace_id, session_id: safe(input.session_id) || `session-${randomUUID()}`, task_id: safe(input.task_id), timestamp, source: safe(input.source) || 'mcg', status: 'started', operation_type: 'trace.start' };
  await append(root, trace_id, row); return row;
}

export async function startSpan(root, trace, input = {}) {
  const timestamp = new Date().toISOString(); const span = { trace_id: trace.trace_id, session_id: trace.session_id, task_id: trace.task_id || safe(input.task_id), turn_id: safe(input.turn_id), span_id: `span-${randomUUID()}`, parent_span_id: safe(input.parent_span_id) || null, timestamp, started_at: timestamp, duration_ms: null, workspace: safe(input.workspace), agent_name: safe(input.agent_name), agent_role: safe(input.agent_role), executor: safe(input.executor), runtime: safe(input.runtime), ide: safe(input.ide), model: safe(input.model), provider: safe(input.provider), operation_type: safe(input.operation_type) || 'unknown', tool_name: safe(input.tool_name), plugin_id: safe(input.plugin_id), plugin_name: safe(input.plugin_name), skill_name: safe(input.skill_name), mcp_name: safe(input.mcp_name), input_chars: number(input.input_chars), output_chars: number(input.output_chars), input_tokens: number(input.input_tokens), cached_input_tokens: number(input.cached_input_tokens), output_tokens: number(input.output_tokens), reasoning_tokens: number(input.reasoning_tokens), total_tokens: number(input.total_tokens), measurement_type: ['exact', 'estimated', 'unavailable'].includes(input.measurement_type) ? input.measurement_type : 'unavailable', status: 'started', source: safe(input.source) || 'mcg' };
  return append(root, trace.trace_id, span);
}

export async function finishSpan(root, trace, spanId, update = {}) {
  const timestamp = new Date().toISOString();
  return append(root, trace.trace_id, { trace_id: trace.trace_id, span_id: spanId, timestamp, duration_ms: number(update.duration_ms), status: ['completed', 'failed', 'blocked'].includes(update.status) ? update.status : 'completed', output_chars: number(update.output_chars), output_tokens: number(update.output_tokens), error_type: safe(update.error_type), error_message_safe: safe(update.error_message_safe), source: safe(update.source) || 'mcg' });
}

export async function loadTrace(root, traceId) {
  const lines = (await readFile(join(await traceDir(root), `${traceId}.jsonl`), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line));
  const trace = lines[0] || { trace_id: traceId }; const spans = new Map();
  for (const row of lines.slice(1)) { if (!row.span_id) continue; spans.set(row.span_id, { ...(spans.get(row.span_id) || {}), ...row }); }
  return { ...trace, spans: [...spans.values()] };
}

export async function listTraces(root) {
  const dir = await traceDir(root);
  const names = await readdir(dir);
  const traces = [];
  for (const name of names.filter(item => item.endsWith('.jsonl'))) {
    try { traces.push(await loadTrace(root, name.slice(0, -6))); } catch { /* retain readable traces only */ }
  }
  return traces.sort((left, right) => String(right.timestamp || '').localeCompare(String(left.timestamp || '')));
}
