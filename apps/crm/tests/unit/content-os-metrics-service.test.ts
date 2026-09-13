import { describe, expect, it, vi } from "vitest";
import { collectPublicationMetrics, normalizeMetrics, type MetricsRepository } from "@/lib/content-os/distribution/metrics-service";

describe("content OS metrics", () => {
  it("maps aliases and does not fabricate missing values", () => expect(normalizeMetrics({ reactions: 4, link_clicks: 2 })).toEqual({ likes: 4, clicks: 2 }));

  it("persists a tenant-scoped provider snapshot before emitting observation", async () => {
    const order: string[] = [];
    const upsertSnapshot = vi.fn(async (snapshot) => { order.push("persist"); return snapshot; });
    const onPersisted = vi.fn(async () => { order.push("observe"); });
    const db: MetricsRepository = {
      findPublication: vi.fn(async () => ({ id: "j1", providerPublicationId: "remote-1", state: "succeeded" })),
      upsertSnapshot,
    };
    const result = await collectPublicationMetrics(
      db,
      { metrics: vi.fn(async () => ({ impressions: 10, comments: 0 })) },
      { organizationId: "o1", publicationJobId: "j1", capturedAt: "2026-09-07T10:00:00.000Z", sourceVersion: "v1", onPersisted },
    );
    expect(result).toMatchObject({ organization_id: "o1", publication_job_id: "j1", provider_ref: "remote-1", metrics: { impressions: 10, comments: 0 }, source_version: "v1" });
    expect(order).toEqual(["persist", "observe"]);
    expect(onPersisted).toHaveBeenCalledWith(result);
  });

  it("rejects jobs without confirmed remote publication", async () => {
    const db: MetricsRepository = { findPublication: vi.fn(async () => ({ id: "j1", providerPublicationId: null, state: "queued" })), upsertSnapshot: vi.fn() };
    await expect(collectPublicationMetrics(db, { metrics: vi.fn() }, { organizationId: "o1", publicationJobId: "j1" })).rejects.toMatchObject({ code: "metrics_invalid" });
  });
});
