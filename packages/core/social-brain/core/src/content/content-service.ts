import type { ContentStatus } from './status'
import type { ContentItem } from './types'
import { ContentPlanSchema, type ContentPlanInput } from './plan-schema'

export type CreateContentItemInput = ContentPlanInput & {
  workspaceId: string
  status: Extract<ContentStatus, 'DRAFT'>
}

export type UpdateContentItemInput = ContentPlanInput & {
  status?: Extract<ContentStatus, 'DRAFT'>
}

export type ContentRepository = {
  createContentItem(input: CreateContentItemInput): Promise<ContentItem>
  updateContentItem(id: string, input: UpdateContentItemInput): Promise<ContentItem>
  getContentItem(id: string): Promise<ContentItem | null>
}

export type ContentService = {
  createContentPlan(workspaceId: string, input: ContentPlanInput): Promise<ContentItem>
  updateContent(id: string, input: ContentPlanInput): Promise<ContentItem>
  getContentItem(id: string): Promise<ContentItem | null>
}

export class ContentServiceError extends Error {
  readonly code: 'content_not_found' | 'content_not_editable'

  constructor(code: ContentServiceError['code'], message: string) {
    super(message)
    this.name = 'ContentServiceError'
    this.code = code
  }
}

export function createContentService(repository: ContentRepository): ContentService {
  return {
    async createContentPlan(workspaceId, input) {
      const plan = ContentPlanSchema.parse(input)
      return repository.createContentItem({
        workspaceId,
        ...plan,
        status: 'DRAFT',
      })
    },

    async updateContent(id, input) {
      const current = await repository.getContentItem(id)
      if (!current) {
        throw new ContentServiceError('content_not_found', 'Content item not found')
      }

      const plan = ContentPlanSchema.parse(input)
      return repository.updateContentItem(id, {
        ...plan,
        status: 'DRAFT',
      })
    },

    getContentItem(id) {
      return repository.getContentItem(id)
    },
  }
}
