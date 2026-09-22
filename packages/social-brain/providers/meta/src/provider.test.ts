import { describe, expect, it } from 'vitest'

import { MetaProvider } from './provider'

describe('MetaProvider', () => {
  it('implements the current core provider contract', async () => {
    const provider = new MetaProvider({ userToken: '' })

    expect(provider.provider).toBe('meta')
    await expect(provider.listAccounts()).rejects.toThrow(/user token/i)
    await expect(provider.schedulePost({
      providerAccountId: 'page-1',
      caption: 'hello',
      title: null,
      providerMediaAssetIds: ['asset-1'],
      idempotencyKey: 'idem-1',
      scheduledFor: '2026-09-22T12:00:00.000Z',
    })).rejects.toThrow(/not implemented/i)
  })
})
