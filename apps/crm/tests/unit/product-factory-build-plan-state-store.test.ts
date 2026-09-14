import { describe, expect, it, vi } from "vitest";
import { BuildPlanStateStore } from "@/lib/product-factory/build-plan-state-store";

describe("BuildPlanStateStore", () => {
  it("finishes only a RUNNING reservation", async () => {
    const query = vi.fn(async (sql: string) => {
      expect(sql).toContain("and status='RUNNING'");
      expect(sql).toContain("returning id");
      return { rows: [{ id: "state-1" }] };
    });
    const store = new BuildPlanStateStore({ query });
    await expect(store.finish("org-1", "plan-1", "delivery-gate", "SUCCEEDED")).resolves.toBeUndefined();
  });

  it("fails closed when a stale worker loses the terminal transition", async () => {
    const store = new BuildPlanStateStore({
      query: vi.fn(async () => ({ rows: [] })),
    });
    await expect(store.finish("org-1", "plan-1", "delivery-gate", "BLOCKED"))
      .rejects.toThrow("build_plan_state_transition_lost");
  });
});
