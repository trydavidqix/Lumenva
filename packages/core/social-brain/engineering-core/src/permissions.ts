export type PermissionTier = 'TIER_1_AUTO' | 'TIER_2_TASK_SCOPED' | 'TIER_3_EXPLICIT'
export type PermissionDecision = 'AUTO' | 'TASK_SCOPED' | 'EXPLICIT_REQUIRED' | 'DENY'
const tier1 = new Set(['read', 'git.read', 'tests', 'typecheck', 'lint', 'build', 'docs', 'infrastructure.read'])
const tier2 = new Set(['edit', 'test.add', 'branch.create', 'commit'])
const tier3 = new Set(['merge', 'production.deploy', 'production.migration', 'environment.mutate', 'secret.rotate', 'branch.delete', 'database.destroy', 'external.publish'])
export function decidePermission(action: string, context: { taskScoped?: boolean } = {}): { action: string; tier: PermissionTier | null; decision: PermissionDecision; reason: string } {
  if (tier1.has(action)) return { action, tier: 'TIER_1_AUTO', decision: 'AUTO', reason: 'read-only or deterministic local engineering operation' }
  if (tier2.has(action)) return context.taskScoped === true
    ? { action, tier: 'TIER_2_TASK_SCOPED', decision: 'TASK_SCOPED', reason: 'authorized only within the active task scope' }
    : { action, tier: 'TIER_2_TASK_SCOPED', decision: 'DENY', reason: 'task scope is required' }
  if (tier3.has(action)) return { action, tier: 'TIER_3_EXPLICIT', decision: 'EXPLICIT_REQUIRED', reason: 'human approval is required for this external or destructive action' }
  return { action, tier: null, decision: 'DENY', reason: 'unknown actions fail closed' }
}
