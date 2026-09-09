import { z } from "zod";

export const contentEventNames = [
  "content.source_collection_requested",
  "content.competitor_check_requested",
  "content.signal_collected",
  "content.opportunity_created",
  "content.idea_created",
  "content.script_approved",
  "content.asset_requested",
  "content.asset_ready",
  "content.video_requested",
  "content.video_ready",
  "content.publication_requested",
  "content.publication_published",
  "content.publication_failed",
  "content.metrics_collected",
  "content.learning_recorded",
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

export type ContentEventLogRecord = {
  event_type: ContentEvent["type"];
  entity_kind: "content";
  entity_id: string;
  organization_id: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

/** Converts the application event to the durable event_log naming contract. */
export function toContentEventLogRecord(event: ContentEvent): ContentEventLogRecord {
  const { organizationId, entityId, requestId, ...payload } = event.payload;
  return {
    event_type: event.type,
    entity_kind: "content",
    entity_id: entityId,
    organization_id: organizationId,
    payload: { ...payload, organization_id: organizationId, entity_id: entityId },
    metadata: { request_id: requestId },
  };
}
