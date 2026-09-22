import type { HandoffRequest } from './execution-port';

export interface HandoffGuardOptions {
  maxDepth?: number;
  allowSameAgentReentry?: boolean;
  allowRecursive?: boolean;
}

export function validateHandoff(
  request: HandoffRequest,
  options: HandoffGuardOptions = {},
): { ok: true } | { ok: false; reason: string } {
  const maxDepth = options.maxDepth ?? 1;
  if (request.depth > maxDepth) return { ok: false, reason: 'handoff_depth_exceeded' };
  if (!options.allowRecursive && request.recursive) return { ok: false, reason: 'recursive_handoff_denied' };
  if (!options.allowSameAgentReentry && request.from_agent === request.to_agent) {
    return { ok: false, reason: 'same_agent_reentry_denied' };
  }
  return { ok: true };
}
