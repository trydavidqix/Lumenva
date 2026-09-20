import { describe, expect, it, vi } from 'vitest'

import { ScheduleServiceError, createScheduleService } from './schedule-service'
import type { ScheduleRepository } from './types'

function createRepository(overrides: Partial<ScheduleRepository> = {}): ScheduleRepository {
  return {
    getSchedulingState: vi.fn(async () => ({
      contentItemId: 'content-1',
      hasCurrentApproval: false,
    })),
    saveScheduleProposal: vi.fn(async () => undefined),
    clearScheduleProposal: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('schedule proposal service', () => {
  const now = () => new Date('2026-08-17T18:00:00.000Z')

  it('requires a valid ISO timestamp and persists a normalized future proposal', async () => {
    const repository = createRepository()
    const service = createScheduleService(repository, { now })

    await expect(
      service.proposeSchedule('content-1', 'tomorrow afternoon', 'Audience is most active then'),
    ).rejects.toMatchObject({ code: 'schedule_invalid_timestamp' })

    const proposal = await service.proposeSchedule(
      'content-1',
      '2026-08-18T19:30:00+01:00',
      'Audience is most active then',
    )

    expect(proposal).toEqual({
      contentItemId: 'content-1',
      proposedFor: '2026-08-18T18:30:00.000Z',
      rationale: 'Audience is most active then',
    })
    expect(repository.saveScheduleProposal).toHaveBeenCalledWith(
      {
        contentItemId: 'content-1',
        proposedFor: '2026-08-18T18:30:00.000Z',
        rationale: 'Audience is most active then',
        publishMode: 'schedule',
      },
      { invalidateApproval: false },
    )
  })

  it('rejects scheduling in the past', async () => {
    const repository = createRepository()
    const service = createScheduleService(repository, { now })

    await expect(
      service.proposeSchedule('content-1', '2026-08-17T17:59:59Z', 'Too late'),
    ).rejects.toMatchObject({ code: 'schedule_in_past' })
    expect(repository.saveScheduleProposal).not.toHaveBeenCalled()
  })

  it('invalidates a current approval in the same persistence operation when a schedule changes', async () => {
    const repository = createRepository({
      getSchedulingState: vi.fn(async () => ({
        contentItemId: 'content-1',
        hasCurrentApproval: true,
      })),
    })
    const service = createScheduleService(repository, { now })

    await service.proposeSchedule('content-1', '2026-08-18T20:00:00Z', 'Updated slot')

    expect(repository.saveScheduleProposal).toHaveBeenCalledWith(
      {
        contentItemId: 'content-1',
        proposedFor: '2026-08-18T20:00:00.000Z',
        rationale: 'Updated slot',
        publishMode: 'schedule',
      },
      { invalidateApproval: true },
    )
  })

  it('clears a proposal and invalidates a current approval atomically without publishing anything', async () => {
    const repository = createRepository({
      getSchedulingState: vi.fn(async () => ({
        contentItemId: 'content-1',
        hasCurrentApproval: true,
      })),
    })
    const service = createScheduleService(repository, { now })

    await service.clearSchedule('content-1')

    expect(repository.clearScheduleProposal).toHaveBeenCalledWith(
      'content-1',
      { invalidateApproval: true },
    )
  })

  it('returns a stable not-found error', async () => {
    const repository = createRepository({
      getSchedulingState: vi.fn(async () => null),
    })
    const service = createScheduleService(repository, { now })

    await expect(
      service.proposeSchedule('missing', '2026-08-18T20:00:00Z', 'Slot'),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ScheduleServiceError>>({ code: 'content_not_found' }),
    )
  })
})
