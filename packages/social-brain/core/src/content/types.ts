import type { SocialPlatform } from '../social/types'
import type { VideoBrief } from './plan-schema'
import type { ContentStatus } from './status'

export type ContentItem = {
  id: string
  workspaceId: string
  topic: string
  objective: string
  hook: string
  script: string
  videoBrief: VideoBrief | null
  status: ContentStatus
  createdAt: string
}

export type ContentVariant = {
  id: string
  contentItemId: string
  platform: SocialPlatform
  caption: string
  title: string | null
  hashtags: string[]
  metadata: Record<string, unknown>
}
