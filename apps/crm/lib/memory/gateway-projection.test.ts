import { describe, expect, it } from "vitest";
import { rebuildProjectionViaGateway, type MemoryGateway, type MemoryRecord } from "./gateway-projection";

describe("memory gateway projection", () => {
  it("rebuilds subject scope from every backend and applies supersession", async () => {
    const calls: string[] = [];
    const r1: MemoryRecord = { recordId: "r1", subject: "ana", scope: "home:ana", namespace: "home:ana", content: "email antigo", observedAt: "2026-09-10T10:00:00Z", confidence: 0.8 };
    const r2: MemoryRecord = { recordId: "r2", subject: "ana", scope: "home:ana", namespace: "home:ana", content: "email novo", observedAt: "2026-09-11T10:00:00Z", confidence: 0.9, supersedes: "r1" };
    const gateway: MemoryGateway = {
      listBackends: () => ["semantic", "episodic"],
      read: async (backend, query) => {
        calls.push(`${backend}:${query.subject}:${query.scope}`);
        return backend === "semantic" ? [r1] : [r2];
      },
    };
    const projection = await rebuildProjectionViaGateway(gateway, { subject: "ana", scope: "home:ana" });
    expect(calls).toEqual(expect.arrayContaining(["semantic:ana:home:ana", "episodic:ana:home:ana"]));
    expect(projection).toEqual([r2]);
  });
});
