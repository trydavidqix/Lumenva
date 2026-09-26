import type { SupabaseClient } from '@supabase/supabase-js'

import type { BackgroundJobInsert, BackgroundJobRow, Database, Json, TablesUpdate } from '../types'

export type BackgroundJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export type BackgroundJob = {
  id: string
  workspaceId: string
  jobType: string
  payload: Record<string, unknown>
  status: BackgroundJobStatus
  attemptCount: number
  maxAttempts: number
  runAfter: string
  lockedBy: string | null
  lockedAt: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  completedAt: string | null
}

export type EnqueueJobInput = {
  workspaceId: string
  jobType: string
  payload: Record<string, unknown>
  maxAttempts?: number
  runAfter?: string
}

export type BackgroundJobPatch = Partial<
  Pick<
    BackgroundJob,
    | 'status'
    | 'runAfter'
    | 'lockedBy'
    | 'lockedAt'
    | 'lastErrorCode'
    | 'lastErrorMessage'
    | 'completedAt'
  >
>

export type JobFailure = {
  code: string
  message: string
}

export type BackgroundJobStore = {
  insert(input: EnqueueJobInput): Promise<BackgroundJob>
  claim(workerId: string): Promise<BackgroundJob | null>
  update(id: string, patch: BackgroundJobPatch): Promise<BackgroundJob>
}

export type BackgroundJobRepository = {
  enqueueJob(input: EnqueueJobInput): Promise<BackgroundJob>
  claimNextJob(workerId: string): Promise<BackgroundJob | null>
  completeJob(id: string): Promise<BackgroundJob>
  failJob(id: string, error: JobFailure, nextRunAt?: string): Promise<BackgroundJob>
}

export function createBackgroundJobRepository(
  store: BackgroundJobStore,
  now: () => Date = () => new Date(),
): BackgroundJobRepository {
  return {
    enqueueJob(input) {
      return store.insert(input)
    },

    claimNextJob(workerId) {
      return store.claim(workerId)
    },

    completeJob(id) {
      return store.update(id, {
        status: 'succeeded',
        lockedBy: null,
        lockedAt: null,
        completedAt: now().toISOString(),
        lastErrorCode: null,
        lastErrorMessage: null,
      })
    },

    failJob(id, error, nextRunAt) {
      if (nextRunAt) {
        return store.update(id, {
          status: 'queued',
          runAfter: nextRunAt,
          lockedBy: null,
          lockedAt: null,
          completedAt: null,
          lastErrorCode: error.code,
          lastErrorMessage: error.message,
        })
      }

      return store.update(id, {
        status: 'failed',
        lockedBy: null,
        lockedAt: null,
        completedAt: now().toISOString(),
        lastErrorCode: error.code,
        lastErrorMessage: error.message,
      })
    },
  }
}

export function createSupabaseBackgroundJobStore(
  client: SupabaseClient<Database>,
): BackgroundJobStore {
  return {
    async insert(input) {
      const row: BackgroundJobInsert = {
        workspace_id: input.workspaceId,
        job_type: input.jobType,
        payload: input.payload as Json,
      }
      if (input.maxAttempts !== undefined) row.max_attempts = input.maxAttempts
      if (input.runAfter !== undefined) row.run_after = input.runAfter

      const { data, error } = await client
        .from('background_jobs')
        .insert(row)
        .select('*')
        .single()

      if (error || !data) throw new Error('Failed to enqueue background job')
      return mapBackgroundJob(data)
    },

    async claim(workerId) {
      const { data, error } = await client
        .rpc('claim_next_background_job', { p_worker_id: workerId })
        .maybeSingle()

      if (error) throw new Error('Failed to claim background job')
      return data ? mapBackgroundJob(data) : null
    },

    async update(id, patch) {
      const update: TablesUpdate<'background_jobs'> = {}
      if (patch.status !== undefined) update.status = patch.status
      if (patch.runAfter !== undefined) update.run_after = patch.runAfter
      if (patch.lockedBy !== undefined) update.locked_by = patch.lockedBy
      if (patch.lockedAt !== undefined) update.locked_at = patch.lockedAt
      if (patch.lastErrorCode !== undefined) update.last_error_code = patch.lastErrorCode
      if (patch.lastErrorMessage !== undefined) update.last_error_message = patch.lastErrorMessage
      if (patch.completedAt !== undefined) update.completed_at = patch.completedAt

      const { data, error } = await client
        .from('background_jobs')
        .update(update)
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) throw new Error('Failed to update background job')
      return mapBackgroundJob(data)
    },
  }
}

function mapBackgroundJob(row: BackgroundJobRow): BackgroundJob {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    jobType: row.job_type,
    payload: jsonObject(row.payload),
    status: row.status as BackgroundJobStatus,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    runAfter: row.run_after,
    lockedBy: row.locked_by,
    lockedAt: row.locked_at,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    completedAt: row.completed_at,
  }
}

function jsonObject(value: Json): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {}
  return value as Record<string, unknown>
}
