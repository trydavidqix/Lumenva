import { describe, expect, it, vi } from "vitest";
import { beginProjection, markProjectionApplied, markProjectionDeletedByEntity } from "./projection-ledger";

describe("projection ledger", () => {
  it("uses the tenant id and idempotency key when beginning a projection", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: "ledger-1", status: "pending" }] });
    await beginProjection({ query }, { organizationId: "org-a", projectionType: "memory", provider: "mem0", entityType: "contact", entityId: "contact-a", sourceId: "event-a", sourceVersion: "2", idempotencyKey: "memory:event-a:2" });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("organization_id"), expect.arrayContaining(["org-a", "memory:event-a:2"]));
  });

  it("marks only the matching tenant ledger row as applied", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: "ledger-1", status: "applied" }] });
    await markProjectionApplied({ query }, "org-a", "ledger-1");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("organization_id = $2"), ["ledger-1", "org-a"]);
  });

  it("marks every applied ledger row for one entity as deleted, scoped to the org", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: "ledger-1", status: "deleted" }] });
    await markProjectionDeletedByEntity({ query }, "org-a", { provider: "mem0", entityType: "contact", entityId: "contact-a" });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status='deleted'"),
      ["org-a", "mem0", "contact", "contact-a"],
    );
  });
});
