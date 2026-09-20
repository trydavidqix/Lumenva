export type BrightBeanErrorCode =
  | 'unauthorized'
  | 'rate_limited'
  | 'upstream_error'
  | 'request_rejected'
  | 'network_error'
  | 'timeout'
  | 'invalid_response'

export class BrightBeanError extends Error {
  readonly code: BrightBeanErrorCode
  readonly status: number | null

  constructor(code: BrightBeanErrorCode, message: string, status: number | null = null) {
    super(message)
    this.name = 'BrightBeanError'
    this.code = code
    this.status = status
  }
}

export type BrightBeanFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type BrightBeanClientOptions = {
  baseUrl: string
  apiKey: string
  fetchImpl?: BrightBeanFetch
  timeoutMs?: number
}

export class BrightBeanClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetchImpl: BrightBeanFetch
  private readonly timeoutMs: number

  constructor(options: BrightBeanClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.apiKey = options.apiKey
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? 10_000
  }

  get(path: string, search?: URLSearchParams): Promise<unknown> {
    return this.request('GET', path, undefined, search)
  }

  post(path: string, body: unknown): Promise<unknown> {
    return this.request('POST', path, JSON.stringify(body), undefined, 'application/json')
  }

  postForm(path: string, body: FormData): Promise<unknown> {
    return this.request('POST', path, body)
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: BodyInit,
    search?: URLSearchParams,
    contentType?: string,
  ): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${path}`)
    if (search) url.search = search.toString()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const headers = new Headers({
        accept: 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      })
      if (contentType) headers.set('content-type', contentType)

      const init: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      }
      if (body !== undefined) init.body = body

      const response = await this.fetchImpl(url.toString(), init)
      if (!response.ok) throw this.httpError(response.status)

      try {
        return await response.json()
      } catch {
        throw new BrightBeanError('invalid_response', 'BrightBean returned invalid JSON')
      }
    } catch (error) {
      if (error instanceof BrightBeanError) throw error
      if (isAbortError(error)) {
        throw new BrightBeanError('timeout', 'BrightBean request timed out')
      }
      throw new BrightBeanError('network_error', 'BrightBean request failed')
    } finally {
      clearTimeout(timeout)
    }
  }

  private httpError(status: number): BrightBeanError {
    if (status === 401 || status === 403) {
      return new BrightBeanError('unauthorized', 'BrightBean rejected the credential', status)
    }
    if (status === 429) {
      return new BrightBeanError('rate_limited', 'BrightBean rate limit reached', status)
    }
    if (status >= 500) {
      return new BrightBeanError('upstream_error', 'BrightBean upstream service failed', status)
    }
    return new BrightBeanError('request_rejected', 'BrightBean rejected the request', status)
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}
