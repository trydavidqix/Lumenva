import type { BackgroundJob, BackgroundJobRepository, JobFailure } from '@lumenva/db/jobs'

export type JobHandler = (job: BackgroundJob) => Promise<void>

export type JobRunnerOptions = {
  workerId: string
  repository: BackgroundJobRepository
  handlers: Record<string, JobHandler>
  retryDelayMs?: number
  now?: () => Date
  sleep?: (ms: number) => Promise<void>
}

export type RunOptions = {
  maxIterations?: number
  idleDelayMs?: number
}

export type JobRunner = {
  runOnce(): Promise<boolean>
  run(options?: RunOptions): Promise<number>
}

type HandlerErrorShape = {
  code?: unknown
  retryable?: unknown
  message?: unknown
}

function errorToFailure(error: unknown): JobFailure {
  const shape = asHandlerError(error)
  return {
    code: typeof shape?.code === 'string' && shape.code.length > 0 ? shape.code : 'handler_failed',
    message:
      error instanceof Error
        ? error.message
        : typeof shape?.message === 'string'
          ? shape.message
          : String(error),
  }
}

function isExplicitlyTerminal(error: unknown): boolean {
  return asHandlerError(error)?.retryable === false
}

function asHandlerError(error: unknown): HandlerErrorShape | null {
  return error !== null && typeof error === 'object' ? (error as HandlerErrorShape) : null
}

export function createJobRunner(options: JobRunnerOptions): JobRunner {
  const retryDelayMs = options.retryDelayMs ?? 30_000
  const now = options.now ?? (() => new Date())
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))

  async function runOnce(): Promise<boolean> {
    const job = await options.repository.claimNextJob(options.workerId)

    if (!job) {
      return false
    }

    const handler = options.handlers[job.jobType]

    if (!handler) {
      await options.repository.failJob(job.id, {
        code: 'unknown_job_type',
        message: `No handler registered for ${job.jobType}`,
      })
      return true
    }

    try {
      await handler(job)
      await options.repository.completeJob(job.id)
      return true
    } catch (error) {
      const failure = errorToFailure(error)
      const mayRetry = !isExplicitlyTerminal(error) && job.attemptCount < job.maxAttempts

      if (mayRetry) {
        const nextRunAt = new Date(now().getTime() + retryDelayMs).toISOString()
        await options.repository.failJob(job.id, failure, nextRunAt)
      } else {
        await options.repository.failJob(job.id, failure)
      }

      return true
    }
  }

  async function run(runOptions: RunOptions = {}): Promise<number> {
    const maxIterations = Math.max(0, runOptions.maxIterations ?? 1)
    const idleDelayMs = Math.max(0, runOptions.idleDelayMs ?? 1_000)
    let processed = 0

    for (let index = 0; index < maxIterations; index += 1) {
      const didWork = await runOnce()

      if (didWork) {
        processed += 1
      } else if (index + 1 < maxIterations) {
        await sleep(idleDelayMs)
      }
    }

    return processed
  }

  return { runOnce, run }
}
