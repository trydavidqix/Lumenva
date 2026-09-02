import { describe, expect, it } from 'vitest';
import { advanceLearningRollout, startLearningRollout } from '../flywheel/rollout';

const ports = (denyRestore = false) => {
  const calls: string[] = [];
  return {
    calls,
    port: {
      assertRestoreAllowed(level: string) {
        calls.push(`assert:${level}`);
        if (denyRestore) throw new Error('flywheel_restore_level_not_allowed');
      },
      async setCandidateLevel(_ref: string, level: 'shadow' | 'draft') { calls.push(level); },
      async restorePreviousLevel(_ref: string, level: string) { calls.push(`restore:${level}`); },
      async rollback(_ref: string, target: string) { calls.push(`rollback:${target}`); },
    },
  };
};

describe('Phase 6 governed rollout', () => {
  it('starts approved runtime candidates in SHADOW and advances only through DRAFT', async () => {
    const p = ports();
    const shadow = await startLearningRollout({ proposalId: 'p1', candidateRef: 'c1', rollbackTargetRef: 'v1', previousLevel: 'assisted', proposalStatus: 'approved', runtimeAffecting: true }, p.port);
    expect(shadow.currentStage).toBe('shadow');
    expect(p.calls).toEqual(['assert:assisted', 'shadow']);
    const draft = await advanceLearningRollout(shadow, 'draft', p.port);
    expect(draft.currentStage).toBe('draft');
    const restored = await advanceLearningRollout(draft, 'restore', p.port);
    expect(restored.currentStage).toBe('restored_previous_level');
    expect(p.calls).toContain('restore:assisted');
  });

  it('does not touch runtime for eval-only candidates', async () => {
    const p = ports();
    const state = await startLearningRollout({ proposalId: 'p1', candidateRef: 'eval:1', rollbackTargetRef: 'none', previousLevel: 'draft', proposalStatus: 'approved', runtimeAffecting: false }, p.port);
    expect(state.currentStage).toBe('restored_previous_level');
    expect(p.calls).toEqual(['assert:draft']);
  });

  it('rejects unapproved rollout and prohibited stage jumps', async () => {
    const p = ports();
    await expect(startLearningRollout({ proposalId: 'p1', candidateRef: 'c1', rollbackTargetRef: 'v1', previousLevel: 'assisted', proposalStatus: 'rejected', runtimeAffecting: true }, p.port)).rejects.toThrow('flywheel_rollout_not_approved');
    const shadow = await startLearningRollout({ proposalId: 'p1', candidateRef: 'c1', rollbackTargetRef: 'v1', previousLevel: 'assisted', proposalStatus: 'approved', runtimeAffecting: true }, p.port);
    await expect(advanceLearningRollout(shadow, 'restore', p.port)).rejects.toThrow('flywheel_rollout_transition_invalid');
  });

  it('fails closed when Phase 5 controls deny restoring the prior autonomy level', async () => {
    const p = ports(true);
    await expect(startLearningRollout({ proposalId: 'p1', candidateRef: 'c1', rollbackTargetRef: 'v1', previousLevel: 'autopilot_expanded', proposalStatus: 'approved', runtimeAffecting: true }, p.port)).rejects.toThrow('flywheel_restore_level_not_allowed');
    expect(p.calls).toEqual(['assert:autopilot_expanded']);
  });
});
