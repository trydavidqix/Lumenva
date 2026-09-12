import { describe, expect, it } from "vitest";
import { validateBuildPlan, type BuildPlan } from "@/lib/product-factory/build-plan";

const plan = (steps: BuildPlan["steps"]): BuildPlan => ({
  build_plan_id: "bp-1", organization_id: "org-1", project_id: "project-1",
  source_spec_refs: ["spec-1"], asset_manifest_refs: ["assets-1"], target_repo_ref: "repo-1",
  target_branch: "wave9/product-factory", base_sha: "a".repeat(40), allowed_paths: ["apps/site/**"],
  forbidden_paths: [".env", "main"], commands: ["pnpm build"], test_commands: ["pnpm test"],
  acceptance_criteria: ["preview renders"], authority_envelope_ref: "authority-1", status: "DRAFT",
  idempotency_key: "idem-1", steps,
});

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
});
