import { describe, expect, it } from "vitest";

import {
  PublicationIdempotencyConflict,
  PublicationQualityGateError,
  PublicationConsentError,
  applyProviderResult,
  publishContentItem,
} from "@/lib/content-os/distribution/publication-service";

const job = {
  id: "job-1",
  organization_id: "org-1",
  content_item_id: "item-1",
  connection_id: "connection-1",
  idempotency_key: "publish:item-1:v1",
  request_hash: "hash",
  provider_publication_id: null,
  state: "running" as const,
  scheduled_for: null,
  published_at: null,
  published_url: null,
  attempts: 1,
  last_error_code: null,
  last_error_at: null,
};

describe("Content OS publication jobs", () => {
  it("maps a confirmed provider success to a terminal local job", () => {
    const result = applyProviderResult(job, {
      state: "succeeded",
      providerPublicationId: "remote-42",
      publishedUrl: "https://example.test/article",
    });

    expect(result).toMatchObject({
      state: "succeeded",
      provider_publication_id: "remote-42",
      published_url: "https://example.test/article",
    });
    expect(result.published_at).toEqual(expect.any(String));
  });

  it("does not permit a terminal job to be re-run", () => {
    expect(() => applyProviderResult({ ...job, state: "succeeded" }, { state: "running" })).toThrow("Invalid Content OS job transition");
  });

  it("exposes a stable idempotency conflict error", () => {
    const error = new PublicationIdempotencyConflict("different payload");
    expect(error.code).toBe("idempotency_conflict");
  });

  it("blocks publication when the publish quality gate is missing or failed", async () => {
    const repository = {
      findContentItem: async () => ({ id: "item-1", organizationId: "org-1", status: "approved" }),
      findPublishGate: async () => ({ status: "failed" }),
      updateContentItem: async () => undefined,
      createPublicationJob: async () => ({ job, reused: false }),
    };

    await expect(publishContentItem(repository, {
      organizationId: "org-1", contentItemId: "item-1", connectionId: "connection-1",
      idempotencyKey: "publish:item-1:v1", title: "Title", body: {},
    })).rejects.toBeInstanceOf(PublicationQualityGateError);
  });

  it("updates content before creating the same idempotent publication job", async () => {
    const calls: string[] = [];
    const repository = {
      findContentItem: async () => ({ id: "item-1", organizationId: "org-1", status: "approved" }),
      findPublishGate: async () => ({ status: "passed" }),
      updateContentItem: async (input: { status: string }) => { calls.push(`update:${input.status}`); },
      createPublicationJob: async () => { calls.push("job"); return { job, reused: true }; },
    };
    const result = await publishContentItem(repository, {
      organizationId: "org-1", contentItemId: "item-1", connectionId: "connection-1",
      idempotencyKey: "publish:item-1:v1", title: "Title", body: {},
    });
    expect(result.reused).toBe(true);
    expect(calls).toEqual(["update:scheduled", "job"]);
  });

  it("fails closed when generated likeness consent is revoked", async () => {
    const calls: string[] = [];
    const repository = {
      findContentItem: async () => ({ id: "item-1", organizationId: "org-1", status: "approved" }),
      findPublishGate: async () => ({ status: "passed" }),
      findConsent: async () => ({ consent_id: "consent-1", organization_id: "org-1", status: "REVOKED", granted_at: "2026-01-01T00:00:00.000Z", revoked_at: "2026-02-01T00:00:00.000Z", retention_until: null }),
      updateContentItem: async () => { calls.push("update"); },
      createPublicationJob: async () => ({ job, reused: false }),
    };
    await expect(publishContentItem(repository, {
      organizationId: "org-1", contentItemId: "item-1", connectionId: "connection-1", idempotencyKey: "publish:likeness:v1", title: "Title", body: {},
      likenessRefs: ["person-1"], consentRequirements: [{ consent_id: "consent-1", subject_ref: "person-1", channel: "email", purpose: "marketing", likeness_ref: "person-1" }],
    })).rejects.toBeInstanceOf(PublicationConsentError);
    expect(calls).toEqual([]);
  });

  it("rejects a content item from another organization", async () => {
    const repository = {
      findContentItem: async () => ({ id: "item-1", organizationId: "org-other", status: "approved" }),
      findPublishGate: async () => ({ status: "passed" }),
      updateContentItem: async () => undefined,
      createPublicationJob: async () => ({ job, reused: false }),
    };
    await expect(publishContentItem(repository, {
      organizationId: "org-1", contentItemId: "item-1", connectionId: "connection-1",
      idempotencyKey: "publish:item-1:v1", title: "Title", body: {},
    })).rejects.toThrow("Content item not found");
  });
});
