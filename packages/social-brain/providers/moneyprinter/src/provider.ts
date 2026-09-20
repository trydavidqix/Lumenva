import type {
  ProviderHealth,
  VideoGenerationInput,
  VideoGenerator,
  VideoJobRef,
  VideoJobState,
  VideoResult,
} from '@lumenva/core'

import {
  MoneyPrinterClient,
  MoneyPrinterError,
  type MoneyPrinterClientOptions,
} from './client'
import {
  TaskCreatedResponseSchema,
  TaskStatusResponseSchema,
  type MoneyPrinterTaskStatus,
} from './schemas'

export type MoneyPrinterProviderOptions = MoneyPrinterClientOptions

export class MoneyPrinterProvider implements VideoGenerator {
  readonly provider = 'moneyprinter'
  private readonly client: MoneyPrinterClient

  constructor(options: MoneyPrinterProviderOptions) {
    this.client = new MoneyPrinterClient(options)
  }

  async submit(input: VideoGenerationInput): Promise<VideoJobRef> {
    const payload = await this.client.post('/api/v1/videos', {
      video_subject: input.subject,
      video_script: input.script,
      video_aspect: input.videoBrief.format,
      video_count: 1,
    })
    const parsed = TaskCreatedResponseSchema.safeParse(payload)
    if (!parsed.success) throw invalidResponse()

    return {
      provider: this.provider,
      providerJobId: parsed.data.data.task_id,
      state: 'queued',
    }
  }

  async status(providerJobId: string): Promise<VideoJobRef> {
    const task = await this.getTask(providerJobId)
    return {
      provider: this.provider,
      providerJobId,
      state: mapState(task.state),
    }
  }

  async fetchResult(providerJobId: string): Promise<VideoResult> {
    const task = await this.getTask(providerJobId)
    const state = mapState(task.state)

    if (state === 'succeeded') {
      const output = task.videos?.[0] ?? task.combined_videos?.[0]
      if (!output) throw invalidResponse()
      return {
        providerJobId,
        state,
        downloadUrl: this.client.resolveAssetUrl(output),
      }
    }

    if (state === 'failed') {
      const stage = task.failed_stage ? ` during ${task.failed_stage}` : ''
      const detail = task.error ? `: ${this.client.redact(task.error)}` : ''
      return {
        providerJobId,
        state,
        error: {
          code: 'moneyprinter_task_failed',
          message: `MoneyPrinter task failed${stage}${detail}`,
          retryable: false,
        },
      }
    }

    return { providerJobId, state }
  }

  async health(): Promise<ProviderHealth> {
    const startedAt = Date.now()
    try {
      await this.client.get('/api/v1/tasks?page=1&page_size=1')
      return {
        ok: true,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        code: null,
        message: null,
      }
    } catch (error) {
      return {
        ok: false,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        code: error instanceof MoneyPrinterError ? error.code : 'provider_error',
        message: 'MoneyPrinter health check failed',
      }
    }
  }

  private async getTask(providerJobId: string): Promise<MoneyPrinterTaskStatus> {
    const payload = await this.client.get(`/api/v1/tasks/${encodeURIComponent(providerJobId)}`)
    const parsed = TaskStatusResponseSchema.safeParse(payload)
    if (!parsed.success || parsed.data.data.task_id !== providerJobId) {
      throw invalidResponse()
    }
    return parsed.data.data
  }
}

function mapState(state: number): VideoJobState {
  if (state === 4) return 'running'
  if (state === 1) return 'succeeded'
  if (state === -1) return 'failed'
  throw invalidResponse()
}

function invalidResponse(): MoneyPrinterError {
  return new MoneyPrinterError(
    'invalid_response',
    'MoneyPrinter returned an invalid response',
    null,
    false,
  )
}
