import type { VideoBrief } from '../content/plan-schema'

export type VideoJobState = 'queued' | 'running' | 'succeeded' | 'failed'

export type VideoGenerationInput = {
  contentItemId: string
  subject: string
  script: string
  videoBrief: VideoBrief
  idempotencyKey: string
}

export type VideoJobRef = {
  provider: string
  providerJobId: string
  state: VideoJobState
}

export type VideoError = {
  code: string
  message: string
  retryable: boolean
}

export type VideoResult = {
  providerJobId: string
  state: VideoJobState
  downloadUrl?: string
  mimeType?: string
  durationMs?: number
  error?: VideoError
}
