import { describe, expect, it, vi } from 'vitest'

import { createServerNeonClient } from './server'
import type { NeonPool } from './database'
import type { NeonQuery, NeonTransaction } from './contract'

const databaseUrl = 'postgresql://fixture@ep-example-pooler.eu-central-1.aws.neon.tech/app?sslmode=require'
const subject = '00000000-0000-0000-0000-000000000001'
const workspaceId = '00000000-0000-0000-0000-000000000002'

function makePool(identityIsActive = true): NeonPool & { transactionQueries: string[] } {
  const transactionQueries: string[] = []
  const transactionQuery = vi.fn(async (query: NeonQuery): Promise<readonly Record<string, unknown>[]> => {
    transactionQueries.push(query.text)
    if (query.text.includes('lumenva_identities')) {
      return identityIsActive ? [{ user_id: subject }] : []
    }
    return []
  }) as unknown as NeonTransaction['query']
  const transaction: NeonTransaction = {
    query: transactionQuery,
  }
  const poolQuery = vi.fn(async (_query: NeonQuery): Promise<readonly Record<string, unknown>[]> => []) as unknown as NeonPool['query']

  return {
    transactionQueries,
    query: poolQuery,
    transaction: vi.fn(async (run) => run(transaction)),
  }
}

describe('server-side Neon factory', () => {
  it('requires an explicit server-side runtime before creating a pool', () => {
    const createPool = vi.fn(() => makePool())

    expect(() => createServerNeonClient({
      enabled: true,
      session: { subject },
      env: { DATABASE_URL: databaseUrl },
      createPool,
    } as never)).toThrow('server-side runtime is required')
    expect(createPool).not.toHaveBeenCalled()
  })

  it('requires explicit opt-in before creating a pool', () => {
    const createPool = vi.fn(() => makePool())

    expect(() => createServerNeonClient({
      session: { subject, workspaceId },
      env: { DATABASE_URL: databaseUrl },
      runtime: 'node',
      createPool,
    })).toThrow('explicit opt-in')
    expect(createPool).not.toHaveBeenCalled()
  })

  it('creates an identity-bound client only from an authenticated server session', async () => {
    const pool = makePool()
    const createPoolSpy = vi.fn(() => pool)
    const client = createServerNeonClient({
      enabled: true,
      session: { subject, workspaceId },
      env: { DATABASE_URL: databaseUrl },
      runtime: 'node',
      createPool: createPoolSpy,
    })

    await client.withAuthenticatedIdentity(async (transaction) => {
      await transaction.query({ text: 'select protected_data', values: [] })
    })

    expect(createPoolSpy).toHaveBeenCalledWith(databaseUrl)
    expect(pool.transactionQueries).toEqual([
      "select set_config('lumenva.user_id', $1, true)",
      "select set_config('app.workspace_id', $1, true)",
      'select user_id from public.lumenva_identities where user_id = public.current_user_id() and active limit 1',
      'select protected_data',
    ])
  })

  it('rejects an invalid authenticated subject before creating a pool', () => {
    const createPool = vi.fn(() => makePool())

    expect(() => createServerNeonClient({
      enabled: true,
      session: { subject: 'not-a-uuid' },
      env: { DATABASE_URL: databaseUrl },
      runtime: 'node',
      createPool,
    })).toThrow('UUID')
    expect(createPool).not.toHaveBeenCalled()
  })

  it('rejects an empty authenticated subject', () => {
    expect(() => createServerNeonClient({
      enabled: true,
      session: { subject: '  ' },
      env: { DATABASE_URL: databaseUrl },
      runtime: 'node',
      createPool: () => makePool(),
    })).toThrow('subject is required')
  })

  it('rejects an invalid authenticated workspace UUID', () => {
    expect(() => createServerNeonClient({
      enabled: true,
      session: { subject, workspaceId: 'workspace-from-browser' },
      env: { DATABASE_URL: databaseUrl },
      runtime: 'node',
      createPool: () => makePool(),
    })).toThrow('workspaceId must be a valid UUID')
  })

  it('fails closed when the authenticated identity is not active in Neon', async () => {
    const pool = makePool(false)
    const client = createServerNeonClient({
      enabled: true,
      session: { subject },
      env: { DATABASE_URL: databaseUrl },
      runtime: 'node',
      createPool: () => pool,
    })

    await expect(client.withAuthenticatedIdentity(async () => 'unreachable'))
      .rejects.toThrow('not registered or active')
    expect(pool.transactionQueries).toHaveLength(2)
  })

  it('fails closed when DATABASE_URL is absent', () => {
    const createPool = vi.fn(() => makePool())

    expect(() => createServerNeonClient({
      enabled: true,
      session: { subject },
      runtime: 'node',
      createPool,
    })).toThrow('DATABASE_URL is required')
    expect(createPool).not.toHaveBeenCalled()
  })
})
