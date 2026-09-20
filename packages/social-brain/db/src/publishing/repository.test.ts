import { describe, expect, it, vi } from 'vitest'

import { createPublicationRepository } from './repository'
import type { PublicationStore } from './repository'

const ACCOUNT_IDS = [
  'account-instagram',
  'account-facebook',
  'account-tiktok',
  'account-youtube',
]

function store(overrides: Partial<PublicationStore> = {}): PublicationStore {
  return {
    listVariants: vi.fn(async () => [
      { id: 'variant-instagram', platform: 'instagram' },
      { id: 'variant-facebook', platform: 'facebook' },
      { id: 'variant-tiktok', platform: 'tiktok' },
      { id: 'variant-youtube', platform: 'youtube' },
    ]),
    listAccounts: vi.fn(async () => [
      { id: 'account-instagram', platform: 'instagram' },
      { id: 'account-facebook', platform: 'facebook' },
      { id: 'account-tiktok', platform: 'tiktok' },
      { id: 'account-youtube', platform: 'youtube' },
    ]),
    getByIdempotencyKey: vi.fn(async () => null),
    insert: vi.fn(async (input) => ({
      row: {
        id: 'job-1',
        ...input,
        status: 'queued',
      },
      created: true,
    })),
    setContentStatus: vi.fn(async () => true),
    getContentStatus: vi.fn(async () => 'APPROVED'),
    getById: vi.fn(async () => null),
    markForRetry: vi.fn(async () => null),
    ...overrides,
  }
}

describe('publication repository', () => {
  it('maps the four current variants to the approved accounts by platform', async () => {
    const raw = store()
    const repository = createPublicationRepository(raw)

    const targets = await repository.listPublicationTargets('content-1', ACCOUNT_IDS)

    expect(targets).toEqual([
      { contentVariantId: 'variant-instagram', platform: 'instagram', socialAccountId: 'account-instagram' },
      { contentVariantId: 'variant-facebook', platform: 'facebook', socialAccountId: 'account-facebook' },
      { contentVariantId: 'variant-tiktok', platform: 'tiktok', socialAccountId: 'account-tiktok' },
      { contentVariantId: 'variant-youtube', platform: 'youtube', socialAccountId: 'account-youtube' },
    ])
    expect(raw.listAccounts).toHaveBeenCalledWith(ACCOUNT_IDS)
  })

  it('reuses a publish job with the same idempotency key without reporting it as new', async () => {
    const existing = {
      id: 'job-existing',
      workspace_id: 'workspace-1',
      content_item_id: 'content-1',
      content_variant_id: 'variant-instagram',
      social_account_id: 'account-instagram',
      approval_id: 'approval-1',
      platform: 'instagram',
      publish_mode: 'schedule',
      scheduled_for: '2026-08-18T18:30:00.000Z',
      status: 'queued',
      idempotency_key: 'key-1',
    }
    const raw = store({ getByIdempotencyKey: vi.fn(async () => existing) })
    const repository = createPublicationRepository(raw)

    const ensured = await repository.ensurePublishJob({
      workspaceId: 'workspace-1',
      contentItemId: 'content-1',
      contentVariantId: 'variant-instagram',
      socialAccountId: 'account-instagram',
      approvalId: 'approval-1',
      platform: 'instagram',
      publishMode: 'schedule',
      scheduledFor: '2026-08-18T18:30:00.000Z',
      idempotencyKey: 'key-1',
    })

    expect(ensured).toMatchObject({ created: false, job: { id: 'job-existing' } })
    expect(raw.insert).not.toHaveBeenCalled()
  })

  it('inserts a new queued job with canonical database fields', async () => {
    const raw = store()
    const repository = createPublicationRepository(raw)

    const ensured = await repository.ensurePublishJob({
      workspaceId: 'workspace-1',
      contentItemId: 'content-1',
      contentVariantId: 'variant-instagram',
      socialAccountId: 'account-instagram',
      approvalId: 'approval-1',
      platform: 'instagram',
      publishMode: 'schedule',
      scheduledFor: '2026-08-18T18:30:00.000Z',
      idempotencyKey: 'key-new',
    })

    expect(ensured.created).toBe(true)
    expect(raw.insert).toHaveBeenCalledWith({
      workspace_id: 'workspace-1',
      content_item_id: 'content-1',
      content_variant_id: 'variant-instagram',
      social_account_id: 'account-instagram',
      approval_id: 'approval-1',
      platform: 'instagram',
      publish_mode: 'schedule',
      scheduled_for: '2026-08-18T18:30:00.000Z',
      status: 'queued',
      idempotency_key: 'key-new',
    })
  })

  it('moves currently approved content into publication state', async () => {
    const raw = store()
    const repository = createPublicationRepository(raw)

    await repository.markContentPublicationState('content-1', 'schedule')
    await repository.markContentPublicationState('content-2', 'now')

    expect(raw.setContentStatus).toHaveBeenNthCalledWith(1, 'content-1', 'SCHEDULED', 'APPROVED')
    expect(raw.setContentStatus).toHaveBeenNthCalledWith(2, 'content-2', 'PUBLISHING', 'APPROVED')
  })

  it('accepts an idempotent repeat after content already entered the same publication lifecycle', async () => {
    const raw = store({
      setContentStatus: vi.fn(async () => false),
      getContentStatus: vi.fn(async () => 'SCHEDULED'),
    })
    const repository = createPublicationRepository(raw)

    await expect(
      repository.markContentPublicationState('content-1', 'schedule'),
    ).resolves.toBeUndefined()

    expect(raw.getContentStatus).toHaveBeenCalledWith('content-1')
  })

  it('rejects an idempotent repeat if content left the approved publication lifecycle', async () => {
    const raw = store({
      setContentStatus: vi.fn(async () => false),
      getContentStatus: vi.fn(async () => 'REJECTED'),
    })
    const repository = createPublicationRepository(raw)

    await expect(
      repository.markContentPublicationState('content-1', 'schedule'),
    ).rejects.toThrow('Approved content state changed')
  })
})
