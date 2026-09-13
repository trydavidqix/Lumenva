import { describe, expect, it } from "vitest";
import { rebuildProjectionViaGateway, type MemoryGateway, type MemoryRecord } from "./gateway-projection";

describe("memory gateway projection", () => {
  it("rebuilds subject scope from every backend and applies supersession", async () => {
    const calls: string[] = [];
    const r1: MemoryRecord = { recordId: "r1", organizationId: "org-a", subject: "ana", scope: "home:ana", namespace: "home:ana", content: "email antigo", observedAt: "2026-09-10T10:00:00Z", confidence: 0.8 };
    const r2: MemoryRecord = { recordId: "r2", organizationId: "org-a", subject: "ana", scope: "home:ana", namespace: "home:ana", content: "email novo", observedAt: "2026-09-11T10:00:00Z", confidence: 0.9, supersedes: "r1" };
    const gateway: MemoryGateway = {
      listBackends: () => ["semantic", "episodic"],
      read: async (backend, query) => {
        calls.push(`${backend}:${query.subject}:${query.scope}`);
        return backend === "semantic" ? [r1] : [r2];
      },
    };
    const projection = await rebuildProjectionViaGateway(gateway, { organizationId: "org-a", subject: "ana", scope: "home:ana", namespace: "home:ana" });
    expect(calls).toEqual(expect.arrayContaining(["semantic:ana:home:ana", "episodic:ana:home:ana"]));
    expect(projection).toEqual([r2]);
  });

  it("filtra registros e namespace de outro tenant mesmo quando o backend os devolve", async () => {
    const foreign: MemoryRecord = { recordId: "foreign", organizationId: "org-b", subject: "ana", scope: "home:ana", namespace: "home:ana", content: "segredo de B", observedAt: "2026-09-12T10:00:00Z", confidence: 1 };
    const wrongNamespace: MemoryRecord = { recordId: "wrong-namespace", organizationId: "org-a", subject: "ana", scope: "company:ana", namespace: "company:ana", content: "empresa", observedAt: "2026-09-12T10:00:00Z", confidence: 1 };
    const gateway: MemoryGateway = { listBackends: () => ["graphiti"], read: async (_backend, query) => {
      expect(query).toMatchObject({ organizationId: "org-a", namespace: "home:ana" });
      return [foreign, wrongNamespace];
    } };
    const projection = await rebuildProjectionViaGateway(gateway, { organizationId: "org-a", subject: "ana", scope: "home:ana", namespace: "home:ana" });
    expect(projection).toEqual([]);
  });
});
