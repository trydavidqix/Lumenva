import type { ScheduleProposal, ScheduleRepository } from './types'

export type ScheduleService = {
  proposeSchedule(contentItemId: string, proposedFor: string, rationale: string): Promise<ScheduleProposal>
  clearSchedule(contentItemId: string): Promise<void>
}

export type ScheduleServiceOptions = {
  now?: () => Date
}

export class ScheduleServiceError extends Error {
  readonly code:
    | 'content_not_found'
    | 'schedule_invalid_timestamp'
    | 'schedule_in_past'

  constructor(code: ScheduleServiceError['code'], message: string) {
    super(message)
    this.name = 'ScheduleServiceError'
    this.code = code
  }
}

export function createScheduleService(
  repository: ScheduleRepository,
  options: ScheduleServiceOptions = {},
): ScheduleService {
  const now = options.now ?? (() => new Date())

  return {
    async proposeSchedule(contentItemId, proposedFor, rationale) {
      const current = await repository.getSchedulingState(contentItemId)
      if (!current) {
        throw new ScheduleServiceError('content_not_found', 'Content item not found')
      }

      const normalized = parseIsoTimestamp(proposedFor)
      if (normalized.getTime() < now().getTime()) {
        throw new ScheduleServiceError('schedule_in_past', 'Scheduled time must not be in the past')
      }

      const proposal: ScheduleProposal = {
        contentItemId,
        proposedFor: normalized.toISOString(),
        rationale: rationale.trim(),
      }

      await repository.saveScheduleProposal(
        {
          ...proposal,
          publishMode: 'schedule',
        },
        { invalidateApproval: current.hasCurrentApproval },
      )

      return proposal
    },

    async clearSchedule(contentItemId) {
      const current = await repository.getSchedulingState(contentItemId)
      if (!current) {
        throw new ScheduleServiceError('content_not_found', 'Content item not found')
      }

      await repository.clearScheduleProposal(
        contentItemId,
        { invalidateApproval: current.hasCurrentApproval },
      )
    },
  }
}

function parseIsoTimestamp(value: string): Date {
  const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
  if (!isoTimestamp.test(value)) {
    throw new ScheduleServiceError('schedule_invalid_timestamp', 'A valid ISO timestamp is required')
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new ScheduleServiceError('schedule_invalid_timestamp', 'A valid ISO timestamp is required')
  }

  return parsed
}
