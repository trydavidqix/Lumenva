import { describe, expect, it, vi } from 'vitest'

import { createScheduleRepository } from './repository'

describe('schedule repository', () => {
  it('reads current approval state from content status', async () => {
    const store = {
      getState: vi.fn(async () => ({ id: 'content-1', status: 'APPROVED' })),
      update: vi.fn(async () => undefined),
    }
    const repository = createScheduleRepository(store)

    await expect(repository.getSchedulingState('content-1')).resolves.toEqual({
      contentItemId: 'content-1',
      hasCurrentApproval: true,
    })
  })

  it('persists a schedule and invalidates approval in one update', async () => {
    const store = {
      getState: vi.fn(async () => ({ id: 'content-1', status: 'APPROVED' })),
      update: vi.fn(async () => undefined),
    }
    const repository = createScheduleRepository(store)

    await repository.saveScheduleProposal(
      {
        contentItemId: 'content-1',
        proposedFor: '2026-08-18T20:00:00.000Z',
        rationale: 'Evening audience window',
        publishMode: 'schedule',
      },
      { invalidateApproval: true },
    )

    expect(store.update).toHaveBeenCalledTimes(1)
    expect(store.update).toHaveBeenCalledWith('content-1', {
      proposed_publish_mode: 'schedule',
      proposed_scheduled_for: '2026-08-18T20:00:00.000Z',
      schedule_rationale: 'Evening audience window',
      status: 'READY_FOR_REVIEW',
    })
  })

  it('preserves status when no approval needs invalidation', async () => {
    const store = {
      getState: vi.fn(async () => ({ id: 'content-1', status: 'READY_FOR_REVIEW' })),
      update: vi.fn(async () => undefined),
    }
    const repository = createScheduleRepository(store)

    await repository.saveScheduleProposal(
      {
        contentItemId: 'content-1',
        proposedFor: '2026-08-18T20:00:00.000Z',
        rationale: 'Evening audience window',
        publishMode: 'schedule',
      },
      { invalidateApproval: false },
    )

    expect(store.update).toHaveBeenCalledWith('content-1', {
      proposed_publish_mode: 'schedule',
      proposed_scheduled_for: '2026-08-18T20:00:00.000Z',
      schedule_rationale: 'Evening audience window',
    })
  })

  it('clears all schedule fields atomically', async () => {
    const store = {
      getState: vi.fn(async () => ({ id: 'content-1', status: 'APPROVED' })),
      update: vi.fn(async () => undefined),
    }
    const repository = createScheduleRepository(store)

    await repository.clearScheduleProposal('content-1', { invalidateApproval: true })

    expect(store.update).toHaveBeenCalledWith('content-1', {
      proposed_publish_mode: null,
      proposed_scheduled_for: null,
      schedule_rationale: null,
      status: 'READY_FOR_REVIEW',
    })
  })
})
