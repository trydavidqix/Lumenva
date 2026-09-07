import { describe, expect, it, vi } from "vitest";

import { detectContentDecay, evaluateDecay } from "@/lib/content-os/learning/decay-service";
import { createRefreshCandidate, type UpdateRepository } from "@/lib/content-os/learning/update-service";

const org = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const refreshId = "33333333-3333-4333-8333-333333333333";
const now = "2026-09-07T00:00:00.000Z";

function item(overrides: Record<string, unknown> = {}) {
  return { id: itemId, organizationId: org, title: "Agentes de IA", contentType: "blog", status: "published", publishedAt: "2026-06-01T00:00:00.000Z", ...overrides } as const;
}

function snapshots() {
  return [
    { organizationId: org, contentItemId: itemId, capturedAt: "2026-07-01T00:00:00.000Z", metrics: { impressions: 1_000 } },
    { organizationId: org, contentItemId: itemId, capturedAt: "2026-08-10T00:00:00.000Z", metrics: { impressions: 800 } },
    { organizationId: org, contentItemId: itemId, capturedAt: "2026-09-01T00:00:00.000Z", metrics: { impressions: 500 } },
  ];
}

describe("Content OS learning flywheel", () => {
  it("detects a tenant-scoped performance decline from cumulative snapshots", () => {
    const candidate = evaluateDecay(item(), snapshots(), { now });
    expect(candidate).toMatchObject({ organizationId: org, contentItemId: itemId, severity: "medium", current: { value: 500 }, baseline: { value: 800, metric: "impressions" } });
    expect(candidate?.relativeDrop).toBeCloseTo(0.375);
  });

  it("fails closed for young, unpublished, missing-baseline and cross-tenant content", () => {
    expect(evaluateDecay(item({ status: "draft" }), snapshots(), { now })).toBeNull();
    expect(evaluateDecay(item({ publishedAt: "2026-08-20T00:00:00.000Z" }), snapshots(), { now })).toBeNull();
    expect(evaluateDecay(item(), snapshots().slice(2), { now })).toBeNull();
    expect(evaluateDecay(item(), snapshots().map((snapshot) => ({ ...snapshot, organizationId: "44444444-4444-4444-8444-444444444444" })), { now })).toBeNull();
  });

  it("loads metrics with an explicit organization and returns no cross-tenant result", async () => {
    const repository = { listPublishedContent: vi.fn(async (organizationId: string) => [item({ organizationId }), item({ id: "55555555-5555-4555-8555-555555555555", organizationId: "44444444-4444-4444-8444-444444444444" })]), listMetricSnapshots: vi.fn(async () => snapshots()) };
    const result = await detectContentDecay(repository, { organizationId: org, now });
    expect(result).toHaveLength(1);
    expect(repository.listMetricSnapshots).toHaveBeenCalledWith(org, [itemId]);
  });

  it("creates a refresh draft plus idempotent learning events", async () => {
    const records = new Map<string, ReturnType<UpdateRepository["findLearningEvent"]>>();
    const candidates = new Map<string, Awaited<ReturnType<UpdateRepository["findRefreshCandidate"]>>>();
    const repository: UpdateRepository = {
      findRefreshCandidate: vi.fn(async (_organizationId, key) => candidates.get(key) ?? null),
      createRefreshCandidate: vi.fn(async (input) => { const created = { ...input, id: refreshId }; candidates.set(input.idempotencyKey, created); return created; }),
      findLearningEvent: vi.fn(async (_organizationId, key) => await records.get(key) ?? null),
      createLearningEvent: vi.fn(async (input) => { const created = { ...input }; records.set(input.idempotencyKey, Promise.resolve(created)); return created; }),
    };
    const decay = evaluateDecay(item(), snapshots(), { now })!;
    const first = await createRefreshCandidate(repository, decay);
    const second = await createRefreshCandidate(repository, decay);
    expect(first.candidate).toMatchObject({ organizationId: org, sourceContentItemId: itemId, contentType: "blog.refresh", status: "draft" });
    expect(first.events).toHaveLength(2);
    expect(second.candidateReused).toBe(true);
    expect(repository.createRefreshCandidate).toHaveBeenCalledTimes(1);
    expect(repository.createLearningEvent).toHaveBeenCalledTimes(2);
  });
});
