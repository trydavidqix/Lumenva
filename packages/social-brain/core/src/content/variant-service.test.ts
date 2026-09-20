import { describe, expect, it, vi } from 'vitest'

import type { ContentVariant } from './types'

const variants = [
  variant('instagram', 'Instagram caption'),
  variant('facebook', 'Facebook caption'),
  variant('tiktok', 'TikTok caption'),
  variant('youtube', 'YouTube caption', { contentType: 'shorts' }),
]

describe('platform variant service', () => {
  it('requires exactly one variant for each V1 platform', async () => {
    const mod = await import('./variant-service').catch(() => null)
    expect(mod, 'variant service module must exist').not.toBeNull()
    if (!mod) return

    const repository = {
      saveVariants: vi.fn(async () => [] as ContentVariant[]),
      updateVariant: vi.fn(async () => variants[0] as ContentVariant),
      listVariants: vi.fn(async () => [] as ContentVariant[]),
    }
    const service = mod.createVariantService(repository)

    await service.savePlatformVariants('content-1', variants)
    expect(repository.saveVariants).toHaveBeenCalledTimes(1)

    await expect(service.savePlatformVariants('content-1', variants.slice(0, 3))).rejects.toMatchObject({
      code: 'invalid_variant_set',
    })
    await expect(
      service.savePlatformVariants('content-1', [
        variants[0]!,
        variants[0]!,
        variants[2]!,
        variants[3]!,
      ]),
    ).rejects.toMatchObject({ code: 'invalid_variant_set' })
  })

  it('rejects unsupported platforms and explicit long-form YouTube metadata', async () => {
    const mod = await import('./variant-service').catch(() => null)
    expect(mod, 'variant service module must exist').not.toBeNull()
    if (!mod) return

    const service = mod.createVariantService({
      saveVariants: vi.fn(async () => [] as ContentVariant[]),
      updateVariant: vi.fn(async () => variants[0] as ContentVariant),
      listVariants: vi.fn(async () => [] as ContentVariant[]),
    })

    await expect(
      service.savePlatformVariants('content-1', [
        variants[0]!,
        variants[1]!,
        variants[2]!,
        { ...variants[3]!, platform: 'linkedin' as never },
      ]),
    ).rejects.toBeDefined()

    await expect(
      service.savePlatformVariants('content-1', [
        variants[0]!,
        variants[1]!,
        variants[2]!,
        variant('youtube', 'Long form', { contentType: 'long-form' }),
      ]),
    ).rejects.toBeDefined()
  })

  it('updates one platform without mutating sibling variants', async () => {
    const mod = await import('./variant-service').catch(() => null)
    expect(mod, 'variant service module must exist').not.toBeNull()
    if (!mod) return

    const stored = new Map(variants.map((item) => [item.platform, toStored(item)]))
    const repository = {
      saveVariants: vi.fn(async () => [...stored.values()]),
      updateVariant: vi.fn(async (_contentItemId: string, input: typeof variants[number]) => {
        const current = stored.get(input.platform)
        if (!current) throw new Error('variant_not_found')
        const updated = { ...current, ...input }
        stored.set(input.platform, updated)
        return updated
      }),
      listVariants: vi.fn(async () => [...stored.values()]),
    }
    const service = mod.createVariantService(repository)
    const facebookBefore = structuredClone(stored.get('facebook'))

    await service.updatePlatformVariant('content-1', {
      ...variants[0]!,
      caption: 'Changed only Instagram',
    })

    expect(repository.updateVariant).toHaveBeenCalledTimes(1)
    expect(stored.get('instagram')?.caption).toBe('Changed only Instagram')
    expect(stored.get('facebook')).toEqual(facebookBefore)
  })
})

function variant(
  platform: 'instagram' | 'facebook' | 'tiktok' | 'youtube',
  caption: string,
  metadata: Record<string, unknown> = {},
) {
  return {
    platform,
    title: null,
    caption,
    hashtags: ['social'],
    metadata,
  }
}

function toStored(input: ReturnType<typeof variant>): ContentVariant {
  return {
    id: `variant-${input.platform}`,
    contentItemId: 'content-1',
    ...input,
  }
}
