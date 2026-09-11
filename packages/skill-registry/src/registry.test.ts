import { describe, expect, it } from "vitest";
import { createSkillRegistry, loadSkillBody, releaseSkill, searchSkills, type SkillDefinition } from "./registry";
const skills: SkillDefinition[] = [
  { name: "pricing", version: "skill_2026.09.11_001", description: "pricing lookup", triggers: ["pricing_lookup", "price"], capabilities: ["pricing_lookup"], dependencies: [], instructionsPath: "pricing/SKILL.md", body: "use approved prices", references: [{ path: "references/catalog.md", title: "Catalog", loadWhen: ["pricing_lookup"], tokenEstimate: 12 }], riskLevel: "R1", orgScope: "global" },
  { name: "refund", version: "skill_2026.09.11_001", description: "refund workflow", triggers: ["refund"], capabilities: ["payment.refund"], dependencies: [], instructionsPath: "refund/SKILL.md", body: "refund only with approval", references: [], riskLevel: "R4", orgScope: "org", organizationId: "org-1" },
];
describe("Skill Registry provider-free", () => {
  it("searches by capability or trigger and caps shortlist", () => {
    const registry = createSkillRegistry(skills);
    expect(searchSkills(registry, { query: "pricing_lookup", maxResults: 1 })).toHaveLength(1);
    expect(searchSkills(registry, { query: "price", maxResults: 1 })[0]?.name).toBe("pricing");
  });
  it("filters by role policy before loading and loads body only", () => {
    const registry = createSkillRegistry(skills);
    const visible = searchSkills(registry, { query: "refund", maxResults: 2, policy: { allowedTags: ["pricing_lookup"], maxRisk: "R3", organizationId: "org-1" } });
    expect(visible).toEqual([]);
    const loaded = loadSkillBody(skills[0]!);
    expect(loaded).toBe("use approved prices");
    expect(releaseSkill(loaded)).toBe("");
  });
});
