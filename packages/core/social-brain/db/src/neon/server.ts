import { createNeonClient } from './client'
import { createNeonExecutor, type NeonPoolFactory } from './database'
import type { NeonIdentityContext, NeonRuntime, NeonTransaction } from './contract'
import { assertNeonIdentity } from './identity'

export interface AuthenticatedNeonSession extends NeonIdentityContext {}

export interface ServerNeonClient {
  query: <Row = Record<string, unknown>>(query: { readonly text: string; readonly values: readonly unknown[] }) => Promise<readonly Row[]>
  withAuthenticatedIdentity<Result>(run: (transaction: NeonTransaction) => Promise<Result>): Promise<Result>
}

export interface ServerNeonClientInput {
  readonly enabled?: boolean
  readonly session: AuthenticatedNeonSession
  readonly databaseUrl?: string
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly runtime: NeonRuntime
  readonly createPool: NeonPoolFactory
}

export function createServerNeonClient(input: ServerNeonClientInput): ServerNeonClient {
  if (input.enabled !== true) throw new Error('Neon adapter requires explicit opt-in')
  if (input.runtime === undefined || input.runtime === 'unknown') {
    throw new Error('Neon server-side runtime is required')
  }
  assertNeonIdentity(input.session)

  const executorInput = {
    ...(input.databaseUrl === undefined ? {} : { databaseUrl: input.databaseUrl }),
    ...(input.env === undefined ? {} : { env: input.env }),
    runtime: input.runtime,
    createPool: input.createPool,
  }
  const client = createNeonClient(createNeonExecutor(executorInput))

  return {
    query: client.query,
    withAuthenticatedIdentity: (run) => client.withIdentity(input.session, run),
  }
}
