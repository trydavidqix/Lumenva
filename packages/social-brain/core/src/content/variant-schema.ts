import { z } from 'zod'

import type { SocialPlatform } from '../social/types'

export const V1_PLATFORMS = [
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
] as const satisfies readonly SocialPlatform[]

export const ContentVariantInputSchema = z
  .object({
    platform: z.enum(V1_PLATFORMS),
    title: z.string().trim().min(1).nullable(),
    caption: z.string().trim().min(1),
    hashtags: z.array(z.string().trim().min(1)),
    metadata: z.record(z.string(), z.unknown()),
  })
  .strict()
  .superRefine((variant, context) => {
    if (
      variant.platform === 'youtube' &&
      variant.metadata.contentType !== undefined &&
      variant.metadata.contentType !== 'shorts'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['metadata', 'contentType'],
        message: 'YouTube variants must be Shorts-compatible',
      })
    }
  })

export type ContentVariantInput = z.infer<typeof ContentVariantInputSchema>
