import type { ContentVariant } from './types'
import {
  ContentVariantInputSchema,
  V1_PLATFORMS,
  type ContentVariantInput,
} from './variant-schema'

export type VariantRepository = {
  saveVariants(contentItemId: string, variants: ContentVariantInput[]): Promise<ContentVariant[]>
  updateVariant(contentItemId: string, variant: ContentVariantInput): Promise<ContentVariant>
  listVariants(contentItemId: string): Promise<ContentVariant[]>
  markContentDraft(contentItemId: string): Promise<void>
}

export type VariantService = {
  savePlatformVariants(contentItemId: string, variants: ContentVariantInput[]): Promise<ContentVariant[]>
  updatePlatformVariant(contentItemId: string, variant: ContentVariantInput): Promise<ContentVariant>
  listPlatformVariants(contentItemId: string): Promise<ContentVariant[]>
}

export class VariantServiceError extends Error {
  readonly code = 'invalid_variant_set' as const

  constructor(message: string) {
    super(message)
    this.name = 'VariantServiceError'
  }
}

export function createVariantService(repository: VariantRepository): VariantService {
  return {
    async savePlatformVariants(contentItemId, variants) {
      const parsed = variants.map((variant) => ContentVariantInputSchema.parse(variant))
      assertCompleteVariantSet(parsed)
      const saved = await repository.saveVariants(contentItemId, parsed)
      await repository.markContentDraft(contentItemId)
      return saved
    },

    async updatePlatformVariant(contentItemId, variant) {
      const updated = await repository.updateVariant(
        contentItemId,
        ContentVariantInputSchema.parse(variant),
      )
      await repository.markContentDraft(contentItemId)
      return updated
    },

    listPlatformVariants(contentItemId) {
      return repository.listVariants(contentItemId)
    },
  }
}

function assertCompleteVariantSet(variants: ContentVariantInput[]): void {
  const platforms = new Set(variants.map((variant) => variant.platform))
  const complete =
    variants.length === V1_PLATFORMS.length &&
    platforms.size === V1_PLATFORMS.length &&
    V1_PLATFORMS.every((platform) => platforms.has(platform))

  if (!complete) {
    throw new VariantServiceError(
      'Content requires exactly one Instagram, Facebook, TikTok, and YouTube Shorts variant',
    )
  }
}
