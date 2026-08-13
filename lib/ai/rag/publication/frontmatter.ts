/**
 * Validation schema for Obsidian note publication frontmatter.
 *
 * Represents metadata required for a note to be considered publishable
 * to the CRM's knowledge base — status, ownership, versioning, and timestamps.
 *
 * Only PUBLISHED status is eligible for export to the knowledge base;
 * other statuses (DRAFT, REVIEW, ARCHIVED) indicate notes in transit or
 * no longer active.
 */

import { z } from 'zod';

export const PublicationFrontmatterSchema = z
  .object({
    status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']),
    organization_id: z.string().uuid(),
    agent_id: z.string().uuid(),
    title: z.string().trim().min(1),
    source_id: z.string().trim().min(1),
    version: z.number().int().positive(),
    published_at: z.string().datetime(),
  })
  .strict();

export type PublicationFrontmatter = z.infer<typeof PublicationFrontmatterSchema>;

export function validateFrontmatter(input: unknown): PublicationFrontmatter | null {
  const result = PublicationFrontmatterSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function assertPublishableDocument(input: unknown): PublicationFrontmatter {
  const parsed = PublicationFrontmatterSchema.parse(input);

  if (parsed.status !== 'PUBLISHED') {
    throw new Error(
      `Document status must be PUBLISHED to be eligible for knowledge base, got: ${parsed.status}`,
    );
  }

  return parsed;
}
