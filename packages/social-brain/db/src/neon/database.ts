import type { NeonExecutor, NeonQuery, NeonTransaction } from './contract'
import { resolveNeonConnection, type NeonConfigInput } from './config'

export interface NeonPool {
  query<Row = Record<string, unknown>>(query: NeonQuery): Promise<readonly Row[]>
  transaction<Result>(run: (transaction: NeonTransaction) => Promise<Result>): Promise<Result>
}

export interface NeonPoolFactory {
  (databaseUrl: string): NeonPool
}

export interface NeonExecutorInput extends NeonConfigInput {
  readonly createPool: NeonPoolFactory
}

/**
 * Binds the injected Neon pool to DATABASE_URL without owning runtime wiring.
 * The pool factory is the seam for @neondatabase/serverless Pool/Client setup.
 */
export function createNeonExecutor(input: NeonExecutorInput): NeonExecutor {
  const databaseUrl = input.databaseUrl ?? input.env?.DATABASE_URL
  if (databaseUrl === undefined) throw new Error('DATABASE_URL is required')

  const config: NeonConfigInput = input.runtime === undefined
    ? { databaseUrl }
    : { databaseUrl, runtime: input.runtime }
  resolveNeonConnection(config)
  const pool = input.createPool(databaseUrl)

  return {
    query: (query) => pool.query(query),
    transaction: (run) => pool.transaction(run),
  }
}
