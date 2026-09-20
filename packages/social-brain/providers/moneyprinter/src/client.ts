export type MoneyPrinterErrorCode =
  | 'validation_failed'
  | 'unauthorized'
  | 'rate_limited'
  | 'upstream_error'
  | 'request_rejected'
  | 'network_error'
  | 'timeout'
  | 'submission_uncertain'
  | 'invalid_response'

export class MoneyPrinterError extends Error {
  readonly code: MoneyPrinterErrorCode
  readonly status: number | null
  readonly retryable: boolean

  constructor(
    code: MoneyPrinterErrorCode,
    message: string,
    status: number | null = null,
    retryable = false,
  ) {
    super(message)
    this.name = 'MoneyPrinterError'
    this.code = code
    this.status = status
    this.retryable = retryable
  }
}

export type MoneyPrinterFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export type MoneyPrinterClientOptions = {
  baseUrl: string
  apiToken?: string
  fetchImpl?: MoneyPrinterFetch
  timeoutMs?: number
}

export class MoneyPrinterClient {
  private readonly baseUrl: string
  private readonly apiToken: string | undefined
  private readonly fetchImpl: MoneyPrinterFetch
  private readonly timeoutMs: number

  constructor(options: MoneyPrinterClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.apiToken = options.apiToken
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? 30_000
  }

  get(path: string): Promise<unknown> {
    return this.request('GET', path)
  }

  async post(path: string, body: unknown): Promise<unknown> {
    try {
      return await this.request('POST', path, body)
    } catch (error) {
      if (error instanceof MoneyPrinterError && isUncertainSubmissionFailure(error)) {
        throw new MoneyPrinterError(
          'submission_uncertain',
          'MoneyPrinter submission outcome is unknown; do not retry blindly',
          error.status,
          false,
        )
      }
      throw error
    }
  }

  resolveAssetUrl(value: string): string {
    try {
      return new URL(value, `${this.baseUrl}/`).toString()
    } catch {
      throw new MoneyPrinterError(
        'invalid_response',
        'MoneyPrinter returned an invalid asset URL',
        null,
        false,
      )
    }
  }

  redact(value: string): string {
    let safe = value
    if (this.apiToken) safe = safe.split(this.apiToken).join('[redacted]')
    safe = safe.split(this.baseUrl).join('[redacted]')
    return safe
  }

  private async request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    const headers = new Headers({ accept: 'application/json' })
    if (body !== undefined) headers.set('content-type', 'application/json')
    if (this.apiToken) headers.set('authorization', `Bearer ${this.apiToken}`)

    const init: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    }
    if (body !== undefined) init.body = JSON.stringify(body)

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, init)

      if (!response.ok) throw httpError(response.status)

      try {
        return await response.json()
      } catch {
        throw new MoneyPrinterError(
          'invalid_response',
          'MoneyPrinter returned invalid JSON',
          null,
          false,
        )
      }
    } catch (error) {
      if (error instanceof MoneyPrinterError) throw error
      if (isAbortError(error)) {
        throw new MoneyPrinterError('timeout', 'MoneyPrinter request timed out', null, true)
      }
      throw new MoneyPrinterError('network_error', 'MoneyPrinter request failed', null, true)
    } finally {
      clearTimeout(timeout)
    }
  }
}

function normalizeBaseUrl(value: string): string {
  const parsed = new URL(value)
  if (parsed.username || parsed.password) {
    throw new MoneyPrinterError(
      'request_rejected',
      'MoneyPrinter base URL must not contain credentials',
      null,
      false,
    )
  }
  return parsed.toString().replace(/\/+$/, '')
}

function httpError(status: number): MoneyPrinterError {
  if (status === 401 || status === 403) {
    return new MoneyPrinterError(
      'unauthorized',
      'MoneyPrinter rejected the credential',
      status,
      false,
    )
  }
  if (status === 429) {
    return new MoneyPrinterError(
      'rate_limited',
      'MoneyPrinter queue or rate limit reached',
      status,
      true,
    )
  }
  if (status >= 500) {
    return new MoneyPrinterError(
      'upstream_error',
      'MoneyPrinter upstream service failed',
      status,
      true,
    )
  }
  if (status === 400 || status === 422) {
    return new MoneyPrinterError(
      'validation_failed',
      'MoneyPrinter rejected the video request',
      status,
      false,
    )
  }
  return new MoneyPrinterError(
    'request_rejected',
    'MoneyPrinter rejected the request',
    status,
    false,
  )
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function isUncertainSubmissionFailure(error: MoneyPrinterError): boolean {
  return error.code === 'timeout' || error.code === 'network_error' || error.code === 'upstream_error'
}
