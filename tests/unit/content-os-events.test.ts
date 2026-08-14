import { describe, expect, it } from "vitest";

import {
  contentEventNames,
  contentEventSchema,
} from "@/lib/content-os/events";

describe("Content OS event contracts", () => {
  it("defines the canonical event vocabulary", () => {
    expect(contentEventNames).toEqual([
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
    ]);
  });

  it("accepts a tenant-scoped event with local and correlation identifiers", () => {
    expect(
      contentEventSchema.safeParse({
        type: "content.asset.requested",
        payload: {
          organizationId: "11111111-1111-4111-8111-111111111111",
          entityId: "22222222-2222-4222-8222-222222222222",
          requestId: "33333333-3333-4333-8333-333333333333",
        },
      }).success,
    ).toBe(true);
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
