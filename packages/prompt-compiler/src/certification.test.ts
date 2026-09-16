import { describe, expect, it } from "vitest";
import { createPromptModule, SystemPromptCompiler, certifyBirth, type PromptVersion } from "./index.js";

const version: PromptVersion = { id: "sales", version: "1.0.0", compilerVersion: "1.0.0" };
const module = createPromptModule({
  id: "identity",
  version: "1.0.0",
  layer: "agent",
  content: "Act as a sales agent.",
  provenance: { source: "fixture", locator: "fixture://identity" },
});
const compiled = new SystemPromptCompiler().compile({ version, modules: [module] });

function input(overrides: Partial<Parameters<typeof certifyBirth>[0]> = {}) {
  return {
    agent: { id: "sales", version: "1.0.0" },
    compiledPrompt: compiled,
    requiredPromptModules: ["identity"],
    skills: [{ name: "crm-read", version: "1.0.0", capabilities: ["crm.read"] }],
    tools: [{ name: "customer.get", version: "1.0.0", capabilities: ["crm.read"] }],
    policy: { allowedSkillNames: ["crm-read"], allowedToolNames: ["customer.get"], forbiddenCapabilities: ["financial.write"] },
    verification: { rules: [{ envelope: "BUILD", verifyVia: "focused_tests" }], envelopes: ["BUILD"] },
    completion: { conditions: [{ id: "prompt", verifyVia: "evidence_ref" }], verifiedIds: ["prompt"] },
    ...overrides,
  };
}

describe("Certification Pipeline", () => {
  it("returns a deterministic PASS birth artifact", () => {
    const first = certifyBirth(input());
    const second = certifyBirth(input({
      skills: [{ name: "crm-read", version: "1.0.0", capabilities: ["crm.read"] }],
      tools: [{ name: "customer.get", version: "1.0.0", capabilities: ["crm.read"] }],
      policy: { allowedSkillNames: ["crm-read"], allowedToolNames: ["customer.get"], forbiddenCapabilities: ["financial.write"] },
      verification: { rules: [{ envelope: "BUILD", verifyVia: "focused_tests" }], envelopes: ["BUILD"] },
      completion: { conditions: [{ id: "prompt", verifyVia: "evidence_ref" }], verifiedIds: ["prompt"] },
    }));
    expect(first).toEqual(second);
    expect(first.decision).toBe("PASS");
    expect(first.artifact.artifactVersion).toBe("1.0.0");
    expect(first.artifact.artifactHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails closed when a selected tool is not allowed", () => {
    const result = certifyBirth(input({ tools: [{ name: "customer.delete", version: "1.0.0", capabilities: ["crm.delete"] }] }));
    expect(result.decision).toBe("FAIL");
    expect(result.checks.find((check) => check.id === "tools_permitted")?.status).toBe("FAIL");
  });

  it("fails when prompt provenance or required modules is incomplete", () => {
    const result = certifyBirth(input({ requiredPromptModules: ["missing"] }));
    expect(result.decision).toBe("FAIL");
    expect(result.checks.find((check) => check.id === "required_modules")?.status).toBe("FAIL");

    const tampered = { ...compiled, hash: "0".repeat(64) };
    const tamperedResult = certifyBirth(input({ compiledPrompt: tampered }));
    expect(tamperedResult.checks.find((check) => check.id === "prompt_hash")?.status).toBe("FAIL");
  });

  it("fails when verification or completion policy is not satisfied", () => {
    const result = certifyBirth(input({
      verification: { rules: [], envelopes: ["BUILD"] },
      completion: { conditions: [{ id: "prompt", verifyVia: "evidence_ref" }], verifiedIds: [] },
    }));
    expect(result.decision).toBe("FAIL");
    expect(result.checks.filter((check) => check.status === "FAIL").map((check) => check.id)).toEqual(["verification_policy", "completion_policy"]);
  });
});
