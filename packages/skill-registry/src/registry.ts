export const SKILL_RISKS = ["R0","R1","R2","R3","R4"] as const;
export type SkillRisk = (typeof SKILL_RISKS)[number];
export interface SkillReference { path: string; title: string; loadWhen: readonly string[]; tokenEstimate: number; }
export interface SkillDefinition { name: string; version: string; description: string; triggers: readonly string[]; capabilities: readonly string[]; dependencies: readonly string[]; instructionsPath: string; body: string; references: readonly SkillReference[]; riskLevel: SkillRisk; orgScope: "global" | "org"; organizationId?: string; }
export interface SkillPolicy { allowedTags: readonly string[]; maxRisk: SkillRisk; maxSkillsLoaded?: number; organizationId?: string; }
export interface SkillSearch { query: string; maxResults: number; policy?: SkillPolicy; }
export type SkillRegistry = ReadonlyMap<string, SkillDefinition>;
const riskRank = (risk: SkillRisk): number => SKILL_RISKS.indexOf(risk);
export function createSkillRegistry(skills: readonly SkillDefinition[]): SkillRegistry {
  const result = new Map<string, SkillDefinition>();
  for (const skill of skills) {
    if (!skill.name.trim() || !skill.version.trim() || result.has(skill.name)) throw new Error("E_DUPLICATE_SKILL");
    if (skill.orgScope === "org" && !skill.organizationId) throw new Error("E_SKILL_ORGANIZATION_REQUIRED");
    result.set(skill.name, skill);
  }
  return result;
}
function allowed(skill: SkillDefinition, policy: SkillPolicy): boolean {
  if (skill.orgScope === "org" && skill.organizationId !== policy.organizationId) return false;
  if (riskRank(skill.riskLevel) > riskRank(policy.maxRisk)) return false;
  const tags = new Set(policy.allowedTags);
  return skill.capabilities.every((capability) => tags.has(capability));
}
export function searchSkills(registry: SkillRegistry, input: SkillSearch): SkillDefinition[] {
  const query = input.query.trim().toLowerCase();
  const policy = input.policy;
  const ranked = [...registry.values()].filter((skill) => !policy || allowed(skill, policy)).map((skill) => {
    const fields = [skill.name, skill.description, ...skill.triggers, ...skill.capabilities].map((v) => v.toLowerCase());
    const exact = skill.capabilities.some((v) => v.toLowerCase() === query) ? 3 : 0;
    const match = fields.some((v) => v.includes(query)) ? 1 : 0;
    return { skill, score: exact + match };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name));
  const limit = Math.max(0, input.policy?.maxSkillsLoaded ?? input.maxResults);
  return ranked.slice(0, Math.min(input.maxResults, limit)).map((item) => item.skill);
}
export function loadSkillBody(skill: SkillDefinition): string { return skill.body; }
export function loadSkillReference(skill: SkillDefinition, path: string): SkillReference {
  const reference = skill.references.find((candidate) => candidate.path === path);
  if (!reference) throw new Error("E_SKILL_REFERENCE_NOT_DECLARED");
  return reference;
}
export function releaseSkill(_body: string): string { return ""; }
