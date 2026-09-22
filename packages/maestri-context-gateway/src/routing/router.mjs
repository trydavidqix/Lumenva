const rank = { TINY: 0, LIGHT: 1, NORMAL: 2, HEAVY: 3, CRITICAL: 4 };

export function classifyRisk(input = {}) {
  if (Number.isFinite(input.risk)) return `R${Math.max(0, Math.min(4, input.risk))}`;
  if (input.production || input.secrets || input.delete) return 'R4';
  if (input.infra || input.database || input.auth) return 'R3';
  if (input.config || input.dependencies) return 'R2';
  if (input.write) return 'R1';
  return 'R0';
}

export function selectRoute(job = {}, registry = []) {
  const type = job.type || (job.complexity || 'NORMAL').toUpperCase(); const risk = classifyRisk(job); const candidates = registry.filter(item => item.health !== 'CIRCUIT_OPEN' && (!job.capability || item.capabilities?.includes(job.capability))).sort((a, b) => (b.success_rate || 0) - (a.success_rate || 0) || (a.latency || Infinity) - (b.latency || Infinity));
  const selected = candidates[0] || null;
  return { type, risk, reasoning: rank[type] >= rank.HEAVY || risk === 'R3' || risk === 'R4' ? 'high' : rank[type] <= rank.LIGHT ? 'low' : 'medium', selected, owner_approval_required: ['R3', 'R4'].includes(risk), source: 'registry + risk policy', measurement_type: selected ? 'exact' : 'unavailable', timestamp: new Date().toISOString() };
}

export function retryPlan(attempt, context = {}) {
  if (attempt <= 1) return { attempt: 1, strategy: 'normal' };
  if (attempt === 2) return { attempt, strategy: 'smaller-context', reason: context.reason || 'retry' };
  if (attempt === 3) return { attempt, strategy: 'alternate-tool', reason: context.reason || 'retry' };
  if (attempt === 4 && context.allow_fallback !== false) return { attempt, strategy: 'alternate-executor', reason: context.reason || 'retry' };
  return { attempt, strategy: 'BLOCKED', reason: 'retry limit reached' };
}

export class CircuitBreaker {
  constructor({ threshold = 3, cooldown_ms = 60_000 } = {}) { this.threshold = threshold; this.cooldown_ms = cooldown_ms; this.failures = 0; this.opened_at = null; this.reason = null; }
  allow() { if (!this.opened_at) return true; if (Date.now() - this.opened_at >= this.cooldown_ms) { this.opened_at = null; this.failures = 0; return true; } return false; }
  failure(reason = 'failure') { this.failures += 1; this.reason = reason; if (this.failures >= this.threshold) this.opened_at = Date.now(); return this.state(); }
  success() { this.failures = 0; this.opened_at = null; return this.state(); }
  state() { return { status: this.opened_at ? 'CIRCUIT_OPEN' : 'CLOSED', failures: this.failures, opened_at: this.opened_at ? new Date(this.opened_at).toISOString() : null, reason: this.reason, retry_after: this.opened_at ? new Date(this.opened_at + this.cooldown_ms).toISOString() : null }; }
}
