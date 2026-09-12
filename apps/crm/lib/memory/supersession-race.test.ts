import { describe, expect, it } from "vitest";

import { createSupersessionCoordinator, type MemoryEvent } from "./supersession";

const record = (overrides: Partial<MemoryEvent> = {}): MemoryEvent => ({
  recordId: "r1",
  kind: "SEMANTIC",
  organizationId: "org-a",
  subject: "contact:ana",
  scope: "company:org-a",
  authority: 2,
  confidence: 0.8,
  observedAt: "2026-09-12T09:00:00.000Z",
  validUntil: null,
  lifecycle: "active",
  content: "canal_preferido=email",
  ...overrides,
});

describe("supersession atômica", () => {
  it("serializa duas resoluções concorrentes e faz commit uma só vez", async () => {
    const r1 = record();
    const r2 = record({
      recordId: "r2",
      confidence: 0.97,
      observedAt: "2026-09-12T11:00:00.000Z",
      content: "canal_preferido=whatsapp",
    });
    const coordinator = createSupersessionCoordinator();
    let commitCalls = 0;
    let releaseCommit!: () => void;
    const commitStarted = new Promise<void>((resolve) => {
      const commit = async () => {
        commitCalls += 1;
        if (commitCalls === 1) await new Promise<void>((resolveRelease) => {
          releaseCommit = resolveRelease;
          resolve();
        });
      };
      void coordinator.resolve(r1, r2, commit);
      void coordinator.resolve(r1, r2, commit);
    });

    await commitStarted;
    releaseCommit();
    await Promise.all([
      coordinator.resolve(r1, r2, async () => {}),
      coordinator.resolve(r1, r2, async () => {}),
    ]);

    expect(commitCalls).toBe(1);
  });
});
