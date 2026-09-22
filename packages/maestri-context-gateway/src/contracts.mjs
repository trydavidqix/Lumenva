const TYPES = new Set(['task', 'event', 'trace', 'telemetry', 'agent', 'runtime', 'tool', 'plugin', 'mcp', 'alert', 'eval', 'artifact']);
const REQUIRED = {
  task: ['task_id'], event: ['timestamp', 'source'], trace: ['trace_id', 'timestamp', 'source'], telemetry: ['timestamp', 'source', 'measurement_type'], agent: ['name', 'status', 'source'], runtime: ['runtime', 'source'], tool: ['tool_name', 'source'], plugin: ['plugin_id', 'source'], mcp: ['mcp_name', 'source'], alert: ['alert_id', 'created_at', 'delivery_status'], eval: ['run_id', 'variant'], artifact: ['artifact_id', 'type', 'path', 'hash']
};
const TYPES_ALLOWED = new Set(['exact', 'estimated', 'unavailable']);

export function validateContract(type, value) {
  if (!TYPES.has(type) || !value || typeof value !== 'object' || Array.isArray(value)) return { valid: false, errors: ['invalid contract type or value'] };
  const errors = [];
  for (const field of REQUIRED[type] || []) if (value[field] == null || value[field] === '') errors.push(`missing ${field}`);
  if (value.measurement_type != null && !TYPES_ALLOWED.has(value.measurement_type)) errors.push('invalid measurement_type');
  if (value.status != null && typeof value.status !== 'string') errors.push('invalid status');
  return { valid: errors.length === 0, errors };
}

export function normalizeLegacy(value, type) {
  const copy = { ...(value || {}) };
  if (type === 'task') {
    copy.status ||= copy.external_state === 'DONE' || copy.internal_state === 'DONE'
      ? 'completed'
      : copy.internal_state === 'BLOCKED'
        ? 'blocked'
        : copy.internal_state || 'unavailable';
    copy.source ||= 'legacy.task.state'; copy.measurement_type ||= 'unavailable'; copy.timestamp ||= copy.updated_at || copy.created_at || new Date(0).toISOString();
  }
  if (type !== 'task') { copy.source ||= 'legacy'; copy.measurement_type ||= 'unavailable'; copy.timestamp ||= copy.created_at || new Date(0).toISOString(); }
  return copy;
}

export function contractTypes() { return [...TYPES]; }
