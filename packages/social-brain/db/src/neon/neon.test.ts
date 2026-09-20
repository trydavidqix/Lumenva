import { describe, expect, it, vi } from 'vitest'

import { createNeonClient, sql } from './client'
import { createNeonExecutor } from './database'
import { isPooledNeonUrl, resolveNeonConnection } from './config'
import type { NeonExecutor, NeonTransaction } from './contract'
import type { NeonPool } from './database'

const pooledUrl = 'postgresql://user:fixture-secret@ep-example-pooler.eu-central-1.aws.neon.tech/app?sslmode=require'

function mockExecutor(): NeonExecutor & { transactionQueries: NeonQueryRecord[] } {
  const transactionQueries: NeonQueryRecord[] = []
  const transaction: NeonTransaction = {
    query: vi.fn(async (query) => {
      transactionQueries.push(query)
      if (query.text.includes('lumenva_identities')) return [{ user_id: '00000000-0000-0000-0000-000000000001' }] as never
      return []
    }),
  }

  return {
    transactionQueries,
    query: vi.fn(async () => [{ ok: true }]) as NeonExecutor['query'],
    transaction: vi.fn(async (run) => run(transaction)),
  }
}

type NeonQueryRecord = { text: string; values: readonly unknown[] }

describe('Neon connection contract', () => {
  it('reads DATABASE_URL without exposing or transforming its value', () => {
    expect(resolveNeonConnection({ env: { DATABASE_URL: pooledUrl }, runtime: 'serverless' })).toEqual({
      configured: true,
      pooling: 'pooled',
      runtime: 'serverless',
    })
  })

  it('reports missing credentials as configured false', () => {
    expect(resolveNeonConnection({ runtime: 'edge' })).toEqual({
      configured: false,
      pooling: 'unknown',
      runtime: 'edge',
    })
  })

  it('rejects malformed database URLs', () => {
    expect(() => resolveNeonConnection({ databaseUrl: 'not-a-url' })).toThrow('PostgreSQL')
  })

  it('detects Neons pooled endpoint convention', () => {
    expect(isPooledNeonUrl(pooledUrl)).toBe(true)
    expect(isPooledNeonUrl(pooledUrl.replace('-pooler', ''))).toBe(false)
  })
})

describe('Neon query boundary', () => {
  it('builds parameterized SQL rather than interpolating values', async () => {
    const executor = mockExecutor()
    const client = createNeonClient(executor)

    await client.query(sql`select * from users where id = ${'user-1'} and active = ${true}`)

    expect(executor.query).toHaveBeenCalledWith({
      text: 'select * from users where id = $1 and active = $2',
      values: ['user-1', true],
    })
  })

  it('sets identity claims inside the transaction before application work', async () => {
    const executor = mockExecutor()
    const client = createNeonClient(executor)

    await client.withIdentity({ subject: '00000000-0000-0000-0000-000000000001', workspaceId: '00000000-0000-0000-0000-000000000002', claims: { role: 'member' } }, async (transaction) => {
      await transaction.query(sql`select 1`)
      return 'done'
    })

    expect(executor.transactionQueries).toEqual([
      { text: "select set_config('lumenva.user_id', $1, true)", values: ['00000000-0000-0000-0000-000000000001'] },
      { text: "select set_config('app.workspace_id', $1, true)", values: ['00000000-0000-0000-0000-000000000002'] },
      { text: "select set_config('request.jwt.claims', $1, true)", values: ['{"role":"member"}'] },
      { text: 'select user_id from public.lumenva_identities where user_id = public.current_user_id() and active limit 1', values: [] },
      { text: 'select 1', values: [] },
    ])
  })

  it('does not allow an empty identity subject', async () => {
    const executor = mockExecutor()
    const client = createNeonClient(executor)

    await expect(client.withIdentity({ subject: '  ' }, async () => 'unreachable')).rejects.toThrow('subject is required')
    expect(executor.transaction).not.toHaveBeenCalled()
  })
})

describe('Neon DATABASE_URL adapter', () => {
  it('creates an executor that forwards parameterized queries to the URL-bound pool', async () => {
    const queries: NeonQueryRecord[] = []
    const query = vi.fn(async (query: NeonQueryRecord) => {
      queries.push(query)
      return [{ id: 'row-1' }]
    })
    const pool: NeonPool = {
      query: query as NeonPool['query'],
      transaction: vi.fn(async (run: (transaction: NeonTransaction) => Promise<unknown>) =>
        run({ query: async (query) => {
          queries.push(query)
          return []
        } }),
      ) as NeonPool['transaction'],
    }
    const createPool = vi.fn((databaseUrl: string) => {
      expect(databaseUrl).toBe(pooledUrl)
      return pool
    })

    const executor = createNeonExecutor({ env: { DATABASE_URL: pooledUrl }, createPool })
    await expect(executor.query({ text: 'select * from users where id = $1', values: ['user-1'] })).resolves.toEqual([{ id: 'row-1' }])

    expect(createPool).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith({ text: 'select * from users where id = $1', values: ['user-1'] })
    expect(queries).toEqual([{ text: 'select * from users where id = $1', values: ['user-1'] }])
  })

  it('rejects a missing DATABASE_URL before creating a pool', () => {
    const createPool = vi.fn()

    expect(() => createNeonExecutor({ createPool })).toThrow('DATABASE_URL is required')
    expect(createPool).not.toHaveBeenCalled()
  })
})
