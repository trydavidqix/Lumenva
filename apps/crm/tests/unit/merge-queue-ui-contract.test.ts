import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("S-05.07 merge queue UI contract", () => {
  it("expõe página protegida e lista ligada aos hooks existentes", () => {
    const page = read("apps/crm/app/app/merge-queue/page.tsx");
    const list = read("apps/crm/app/app/merge-queue/_components/MergeQueueList.tsx");
    expect(page).toContain("requireAuth");
    expect(page).toContain("Fila de merges");
    expect(list).toContain("useMergeQueue");
    expect(list).toContain("MergeDialog");
    expect(list).toContain("aria-label=\"Fila de merges\"");
  });

  it("declara a porta do sidebar e badge apenas para gestores", () => {
    const registry = read("apps/crm/lib/navigation/registry.ts");
    const sidebar = read("apps/crm/components/shell/Sidebar.tsx");
    expect(registry).toMatch(/href: "\/app\/merge-queue"[\s\S]*minRole: "manager"[\s\S]*sidebar: true/);
    expect(sidebar).toContain("pendingMerges");
    expect(sidebar).toContain("useMergeQueue({ enabled: canReviewMerges })");
  });
});
