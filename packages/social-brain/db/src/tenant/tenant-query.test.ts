import { describe, expect, it, vi } from 'vitest'
import { TenantContext } from '@lumenva/core'
import { createTenantQuery } from './tenant-query'

const context = {
  userId: 'user-a',
  organizationId: 'org-a',
  role: 'manager' as const,
  isPlatformAdmin: false,
  requestId: 'request-1',
  authSource: 'firebase-session' as const,
}

describe('tenant query guard', () => {
  it('fails before SQL when context is absent', async () => {
    const query = vi.fn()
    await expect(createTenantQuery({ query }).run({ text: 'select 1', values: [] })).rejects.toThrow(
      'TenantContext: missing validated context',
    )
    expect(query).not.toHaveBeenCalled()
  })

  it('adds server tenant predicate and ignores caller organization input', async () => {
    const query = vi.fn(async () => [])
    await TenantContext.run(context, () =>
      createTenantQuery({ query }).run({
        text: 'select * from records where id = $1 and organization_id = $2',
        values: ['record-a', 'org-body-b'],
      }),
    )
    expect(query).toHaveBeenCalledWith({
      text: 'select * from records where id = $1 and organization_id = $2',
      values: ['record-a', 'org-a'],
    })
  })

  it('overwrites forced tenant on insert with server tenant', async () => {
    const query = vi.fn(async () => [])
    await TenantContext.run(context, () =>
      createTenantQuery({ query }).run({
        text: 'insert into records (id, organization_id, name) values ($1, $2, $3)',
        values: ['record-a', 'org-body-b', 'A'],
      }),
    )
    expect(query).toHaveBeenCalledWith({
      text: 'insert into records (id, organization_id, name) values ($1, $2, $3)',
      values: ['record-a', 'org-a', 'A'],
    })
  })

  it('forces update target tenant and prevents moving a record across tenants', async () => {
    const query = vi.fn(async () => [])
    await TenantContext.run(context, () =>
      createTenantQuery({ query }).run({
        text: 'update records set organization_id = $2, name = $3 where id = $1',
        values: ['record-a', 'org-body-b', 'renamed'],
      }),
    )
    expect(query).toHaveBeenCalledWith({
      text: 'update records set organization_id = $2, name = $3 where id = $1 AND organization_id = $4',
      values: ['record-a', 'org-a', 'renamed', 'org-a'],
    })
  })

  it.each([
    ['list', 'select * from records', 'select * from records WHERE organization_id = $1', []],
    ['search', 'select * from records where name ilike $1', 'select * from records where name ilike $1 AND organization_id = $2', ['%A%']],
    ['pagination', 'select * from records where id > $1 order by id limit $2', 'select * from records where id > $1 AND organization_id = $3 order by id limit $2', ['record-0', 20]],
    ['aggregation', 'select count(*) from records', 'select count(*) from records WHERE organization_id = $1', []],
    ['delete', 'delete from records where id = $1', 'delete from records where id = $1 AND organization_id = $2', ['record-b']],
  ])('scopes %s by tenant', async (_name, text, expectedText, values) => {
    const query = vi.fn(async () => [])
    await TenantContext.run(context, () => createTenantQuery({ query }).run({ text, values }))
    expect(query).toHaveBeenCalledWith({ text: expectedText, values: [...values, 'org-a'] })
  })

  it('uses SET LOCAL inside every transaction and does not leak pool state', async () => {
    const transactions: Array<Array<{ text: string; values: readonly unknown[] }>> = []
    const executor = {
      query: vi.fn(async () => []),
      transaction: async (run: (tx: { query: typeof executor.query }) => Promise<unknown>) => {
        const queries: Array<{ text: string; values: readonly unknown[] }> = []
        transactions.push(queries)
        return run({
          query: async (statement) => {
            queries.push(statement)
            return []
          },
        })
      },
    }

    await TenantContext.run(context, () => createTenantQuery(executor).transaction(async (tx) => {
      await tx.query({ text: 'select * from records', values: [] })
    }))

    expect(transactions).toHaveLength(1)
    expect(transactions[0]?.[0]).toEqual({
      text: 'select set_config($1, $2, true), set_config($3, $4, true), set_config($5, $6, true)',
      values: ['app.user_id', 'user-a', 'app.organization_id', 'org-a', 'app.role', 'manager'],
    })
  })
})
