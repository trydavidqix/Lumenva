import { describe, expect, it } from "vitest";
import { repairFailedBuildPlan, validateBuildPlan, type BuildPlan } from "@/lib/product-factory/build-plan";
import { BuildPlanStateStore, type BuildPlanStateRow } from "@/lib/product-factory/build-plan-state-store";

const plan = (steps: BuildPlan["steps"]): BuildPlan => ({
  build_plan_id: "bp-1", organization_id: "org-1", project_id: "project-1",
  source_spec_refs: ["spec-1"], asset_manifest_refs: ["assets-1"], target_repo_ref: "repo-1",
  target_branch: "wave9/product-factory", base_sha: "a".repeat(40), allowed_paths: ["apps/site/**"],
  forbidden_paths: [".env", "main"], commands: ["pnpm build"], test_commands: ["pnpm test"],
  acceptance_criteria: ["preview renders"], authority_envelope_ref: "authority-1", status: "DRAFT",
  idempotency_key: "idem-1", steps,
});

const stateStore = () => {
  const rows = new Map<string, BuildPlanStateRow>();
  return new BuildPlanStateStore({
    async query<T>(sql: string, values: unknown[] = []) {
      const key = `${values[0]}:${values[1]}:${values[2]}`;
      if (sql.startsWith("select")) return { rows: (rows.get(key) ? [rows.get(key)!] : []) as T[] };
      if (sql.startsWith("insert")) {
        const previous = rows.get(key);
        if (previous && ["RUNNING", "BLOCKED", "SUCCEEDED"].includes(previous.status)) return { rows: [] as T[] };
        const row: BuildPlanStateRow = { id: key, status: "RUNNING", attempts: (previous?.attempts ?? 0) + 1, blocked_at: null };
        rows.set(key, row);
        return { rows: [row] as T[] };
      }
      const row = rows.get(key);
      if (row) { row.status = String(values[3]); if (row.status === "BLOCKED") row.blocked_at = new Date().toISOString(); }
      return { rows: [] as T[] };
    },
  });
};

describe("BuildPlan", () => {
  it("accepts an acyclic step graph and preserves per-step status", () => {
    const result = validateBuildPlan(plan([
      { step_id: "build", dependencies: [], status: "PENDING" },
      { step_id: "test", dependencies: ["build"], status: "RUNNING" },
      { step_id: "preview", dependencies: ["test"], status: "SUCCEEDED" },
    ]));
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects circular dependencies with the cycle path", () => {
    const result = validateBuildPlan(plan([
      { step_id: "build", dependencies: ["test"], status: "PENDING" },
      { step_id: "test", dependencies: ["preview"], status: "PENDING" },
      { step_id: "preview", dependencies: ["build"], status: "PENDING" },
    ]));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("circular dependency: build -> test -> preview -> build");
  });

  it("rejects duplicate and unknown step references", () => {
    const duplicate = validateBuildPlan(plan([
      { step_id: "build", dependencies: ["missing"], status: "PENDING" },
      { step_id: "test", dependencies: [], status: "PENDING" },
      { step_id: "build", dependencies: [], status: "PENDING" },
    ]));
    expect(duplicate.valid).toBe(false);
    expect(duplicate.errors).toContain("duplicate step id: build");
    const unknown = validateBuildPlan(plan([{ step_id: "build", dependencies: ["missing"], status: "PENDING" }]));
    expect(unknown.valid).toBe(false);
    expect(unknown.errors[0]).toContain("unknown dependency");
  });

  it("retries a failed step until the executor succeeds", async () => {
    let attempts = 0;
    const result = await repairFailedBuildPlan(plan([
      { step_id: "build", dependencies: [], status: "FAILED" },
    ]), async () => {
      attempts += 1;
      return attempts === 3 ? ("SUCCEEDED" as const) : ("FAILED" as const);
    }, { maxAttempts: 3, stateStore: stateStore() });

    expect(attempts).toBe(3);
    expect(result).toMatchObject({ status: "REPAIRED", attempts: 3 });
    expect(result.plan.steps[0]?.status).toBe("SUCCEEDED");
  });

  it("marks the failed step and plan blocked when attempts are exhausted", async () => {
    let attempts = 0;
    const result = await repairFailedBuildPlan(plan([
      { step_id: "build", dependencies: [], status: "FAILED" },
    ]), async () => {
      attempts += 1;
      return "FAILED" as const;
    }, { maxAttempts: 2, stateStore: stateStore() });

    expect(attempts).toBe(2);
    expect(result.status).toBe("BLOCKED");
    expect(result.plan.status).toBe("BLOCKED_EXTERNAL");
    expect(result.plan.steps[0]?.status).toBe("BLOCKED");
  });

  it("rejects re-entry after BLOCKED, even when the caller resends the original plan", async () => {
    const blockedPlan = { ...plan([{ step_id: "terminal", dependencies: [], status: "FAILED" }]), build_plan_id: "bp-terminal" };
    const persistentStore = stateStore();
    await repairFailedBuildPlan(blockedPlan, async () => "FAILED" as const, { maxAttempts: 1, stateStore: persistentStore });

    let executions = 0;
    await expect(repairFailedBuildPlan(blockedPlan, async () => {
      executions += 1;
      return "SUCCEEDED" as const;
    }, { maxAttempts: 10, stateStore: persistentStore })).rejects.toThrow("BuildPlan is terminally BLOCKED");
    expect(executions).toBe(0);

    const replayed = { ...blockedPlan, status: "FAILED" as const,
      steps: [{ step_id: "terminal", dependencies: [], status: "FAILED" as const }] };
    await expect(repairFailedBuildPlan(replayed, async () => "SUCCEEDED" as const, { maxAttempts: 10, stateStore: persistentStore }))
      .rejects.toThrow("BuildPlan is terminally BLOCKED");
  });
});
