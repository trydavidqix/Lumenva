export type NeonRuntime = 'node' | 'serverless' | 'edge' | 'unknown'

export type NeonPooling = 'pooled' | 'direct' | 'unknown'

export interface NeonConnectionContract {
  readonly configured: boolean
  readonly runtime: NeonRuntime
  readonly pooling: NeonPooling
}

export interface NeonIdentityContext {
  readonly subject: string
  readonly workspaceId?: string
  readonly claims?: Readonly<Record<string, unknown>>
}

export interface NeonQuery {
  readonly text: string
  readonly values: readonly unknown[]
}

export interface NeonTransaction {
  query<Row = Record<string, unknown>>(query: NeonQuery): Promise<readonly Row[]>
}

/**
 * Adapter boundary for @neondatabase/serverless (or a test double).
 * The driver is intentionally injected because this package does not own
 * dependency installation or runtime-specific WebSocket setup.
 */
export interface NeonExecutor {
  query<Row = Record<string, unknown>>(query: NeonQuery): Promise<readonly Row[]>
  transaction<Result>(run: (transaction: NeonTransaction) => Promise<Result>): Promise<Result>
}
