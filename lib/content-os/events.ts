import { z } from "zod";

export const contentEventNames = [
  "content.source_collection_requested",
  "content.competitor_check_requested",
  "content.signal.collected",
  "content.opportunity.created",
  "content.idea.created",
  "content.script.approved",
  "content.asset.requested",
  "content.asset.ready",
  "content.video.requested",
  "content.video.ready",
  "content.publication.requested",
  "content.publication.published",
  "content.publication.failed",
  "content.metrics.collected",
  "content.learning.recorded",
] as const;

const contentEventPayloadSchema = z
  .object({
    organizationId: z.uuid(),
    entityId: z.uuid(),
    requestId: z.uuid(),
    provider: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const contentEventSchema = z
  .object({
    type: z.enum(contentEventNames),
    payload: contentEventPayloadSchema,
  })
  .strict();

export type ContentEvent = z.infer<typeof contentEventSchema>;
