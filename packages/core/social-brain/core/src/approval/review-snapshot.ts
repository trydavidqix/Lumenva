import { createHash } from 'node:crypto'

import type { SocialPlatform } from '../social/types'

export type PublishMode = 'schedule' | 'now'

export type ContentVariantSnapshot = {
  platform: SocialPlatform
  caption: string
  title: string | null
  hashtags: string[]
}

export type ReviewSnapshot = {
  contentId: string
  script: string
  mediaAssetIds: string[]
  variants: ContentVariantSnapshot[]
  targetAccountIds: string[]
  scheduledFor: string | null
  publishMode: PublishMode
}

function normalizeSnapshot(snapshot: ReviewSnapshot): ReviewSnapshot {
  return {
    ...snapshot,
    mediaAssetIds: [...snapshot.mediaAssetIds].sort(),
    targetAccountIds: [...snapshot.targetAccountIds].sort(),
    variants: [...snapshot.variants]
      .map((variant) => ({ ...variant, hashtags: [...variant.hashtags] }))
      .sort((a, b) => a.platform.localeCompare(b.platform)),
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    )
  }

  return value
}

export function snapshotHash(snapshot: ReviewSnapshot): string {
  const canonical = JSON.stringify(canonicalize(normalizeSnapshot(snapshot)))
  return createHash('sha256').update(canonical).digest('hex')
}
