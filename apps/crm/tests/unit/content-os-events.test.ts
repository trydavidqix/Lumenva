import { describe, expect, it } from "vitest";

import {
  contentEventNames,
  contentEventSchema,
  toContentEventLogRecord,
} from "@/lib/content-os/events";

describe("Content OS event contracts", () => {
  it("defines the canonical event vocabulary including Creator Commerce evidence", () => {
    expect(contentEventNames).toEqual(expect.arrayContaining([
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
      "content.product_discovered",
      "content.product_shortlisted",
      "content.attribution_created",
      "content.revenue_anomaly_detected",
      "content.experiment_started",
      "content.experiment_completed",
      "content.experiment_winner_detected",
    ]));
  });

  it("accepts backward-compatible optional commercial dimensions", () => {
    const parsed = contentEventSchema.safeParse({
      type: "content.product_shortlisted",
      payload: {
        organizationId: "11111111-1111-4111-8111-111111111111",
        entityId: "22222222-2222-4222-8222-222222222222",
        requestId: "33333333-3333-4333-8333-333333333333",
        creatorId: "44444444-4444-4444-8444-444444444444",
        productId: "55555555-5555-4555-8555-555555555555",
        offerId: "66666666-6666-4666-8666-666666666666",
        campaignId: "77777777-7777-4777-8777-777777777777",
        variantId: "88888888-8888-4888-8888-888888888888",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("maps the validated event to snake_case event_log fields and keeps request_id", () => {
    expect(toContentEventLogRecord({
      type: "content.signal_collected",
      payload: {
        organizationId: "11111111-1111-4111-8111-111111111111",
        entityId: "22222222-2222-4222-8222-222222222222",
        requestId: "33333333-3333-4333-8333-333333333333",
        provider: "rsshub",
      },
    })).toEqual({
      event_type: "content.signal_collected",
      entity_kind: "content",
      entity_id: "22222222-2222-4222-8222-222222222222",
      organization_id: "11111111-1111-4111-8111-111111111111",
      payload: {
        organization_id: "11111111-1111-4111-8111-111111111111",
        entity_id: "22222222-2222-4222-8222-222222222222",
        provider: "rsshub",
      },
      metadata: { request_id: "33333333-3333-4333-8333-333333333333" },
    });
  });

  it("fails closed for malformed tenant context or unknown event names", () => {
    expect(
      contentEventSchema.safeParse({
        type: "content.unknown",
        payload: {
          organizationId: "not-a-uuid",
          entityId: "22222222-2222-4222-8222-222222222222",
          requestId: "33333333-3333-4333-8333-333333333333",
        },
      }).success,
    ).toBe(false);
  });
});
