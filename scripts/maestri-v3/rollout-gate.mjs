export function evaluateRollout({
  branch,
  target = 'vps',
  production = false,
  dirty = false,
} = {}) {
  const blockers = [];

  if (production) blockers.push('production_disabled');
  if (target !== 'vps') blockers.push('target_must_be_vps');
  if (branch !== 'vps') blockers.push('branch_must_be_vps');
  if (dirty) blockers.push('dirty_worktree');

  return {
    status: blockers.length ? 'BLOCKED' : 'READY_FOR_VPS',
    blockers,
    target,
  };
}
