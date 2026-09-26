import type { VideoError } from './types'

export type VideoFailureInput =
  | { kind: 'timeout'; message: string }
  | { kind: 'http'; status: number; message: string }
  | { kind: 'validation'; message: string }
  | { kind: 'auth'; message: string }
  | { kind: 'unknown'; message: string }

export function classifyVideoFailure(input: VideoFailureInput): VideoError {
  if (input.kind === 'timeout') {
    return error('video_timeout', input.message, true)
  }

  if (input.kind === 'validation') {
    return error('video_validation_failed', input.message, false)
  }

  if (input.kind === 'auth') {
    return error('video_auth_failed', input.message, false)
  }

  if (input.kind === 'http') {
    if (input.status === 429) {
      return error('video_rate_limited', input.message, true)
    }
    if (input.status >= 500 && input.status <= 599) {
      return error('video_provider_unavailable', input.message, true)
    }
    if (input.status === 401 || input.status === 403) {
      return error('video_auth_failed', input.message, false)
    }
    if (input.status >= 400 && input.status <= 499) {
      return error('video_validation_failed', input.message, false)
    }
  }

  return error('video_provider_error', input.message, false)
}

export function canRetryVideo(
  failure: VideoError,
  attemptCount: number,
  maxAttempts: number,
): boolean {
  return failure.retryable && maxAttempts > 0 && attemptCount >= 0 && attemptCount < maxAttempts
}

function error(code: string, message: string, retryable: boolean): VideoError {
  return { code, message, retryable }
}
