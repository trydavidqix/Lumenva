import { countPayloadTokens } from '../edge/crm/get-lead-context';

export const SKILL_LIFECYCLE_STATES = [
  'DRAFT',
  'EVALUATING',
  'APPROVED',
  'SHADOW',
  'CANARY',
  'ACTIVE',
  'DEPRECATED',
] as const;

export type SkillLifecycleState = (typeof SKILL_LIFECYCLE_STATES)[number];

const SKILL_LIFECYCLE_TRANSITIONS: Readonly<Record<SkillLifecycleState, readonly SkillLifecycleState[]>> = {
  DRAFT: ['EVALUATING'],
  EVALUATING: ['DRAFT', 'APPROVED'],
  APPROVED: ['DRAFT', 'SHADOW'],
  SHADOW: ['APPROVED', 'CANARY'],
  CANARY: ['SHADOW', 'ACTIVE'],
  ACTIVE: ['CANARY', 'DEPRECATED'],
  DEPRECATED: [],
};

export function canTransitionSkillLifecycle(from: SkillLifecycleState, to: SkillLifecycleState): boolean {
  const destinations: readonly SkillLifecycleState[] = SKILL_LIFECYCLE_TRANSITIONS[from];
  return destinations.includes(to);
}

export interface SkillRegistryEntry {
  id: string;
  version: string;
  organizationId: string | null;
  name: string;
  domain: string;
  status: string;
}

export interface SkillRegistryQuery {
  id?: string;
  version?: string;
  domain?: string;
  status?: string;
}

export function createSkillRegistry<T extends SkillRegistryEntry>(items: readonly T[]): {
  lookup(query: SkillRegistryQuery): T[];
} {
  const snapshot = [...items];
  return {
    lookup(query) {
      return snapshot.filter((item) =>
        (query.id === undefined || item.id === query.id) &&
        (query.version === undefined || item.version === query.version) &&
        (query.domain === undefined || item.domain === query.domain) &&
        (query.status === undefined || item.status === query.status),
      );
    },
  };
}

export function visibleSkillsForTenant<T extends Pick<SkillRegistryEntry, 'organizationId'>>(
  items: readonly T[],
  organizationId: string,
): T[] {
  return items.filter((item) => item.organizationId === null || item.organizationId === organizationId);
}

interface DisclosureSkill {
  name: string;
  description: string;
  body: string;
}

export interface SkillDisclosurePlan {
  index: string;
  selectedBodies: string;
}

export function buildSkillDisclosurePlan(input: {
  skills: readonly DisclosureSkill[];
  selectedNames: readonly string[];
  maxSkillLoads: number;
  maxSkillContextTokens: number;
}): SkillDisclosurePlan {
  const selectedNames = [...new Set(input.selectedNames)];
  if (selectedNames.length > input.maxSkillLoads) {
    throw new Error(`maxSkillLoads exceeded: ${selectedNames.length} > ${input.maxSkillLoads}`);
  }

  const selectedSet = new Set(selectedNames);
  const selected = input.skills.filter((skill) => selectedSet.has(skill.name));
  const index = input.skills.map((skill) => `- ${skill.name}: ${skill.description}`).join('\n');
  const selectedBodies = selected.map((skill) => `### ${skill.name}\n${skill.body}`).join('\n\n');
  const selectedTokens = selectedBodies === '' ? 0 : countPayloadTokens(selectedBodies);

  if (selectedTokens > input.maxSkillContextTokens) {
    throw new Error(
      `maxSkillContextTokens exceeded: ${selectedTokens} > ${input.maxSkillContextTokens}`,
    );
  }

  return { index, selectedBodies };
}

export function resolveSkillToolAccess(input: {
  agentAllowedTools: readonly string[];
  skillAllowedTools: readonly string[];
  skillForbiddenTools: readonly string[];
  policyAllowedTools: readonly string[];
}): { allowed: string[]; denied: Record<string, string> } {
  const agentAllowed = new Set(input.agentAllowedTools);
  const policyAllowed = new Set(input.policyAllowedTools);
  const forbidden = new Set(input.skillForbiddenTools);
  const allowed: string[] = [];
  const denied: Record<string, string> = {};

  for (const toolId of input.skillAllowedTools) {
    if (forbidden.has(toolId)) {
      denied[toolId] = 'skill_forbidden_action';
      continue;
    }
    if (!agentAllowed.has(toolId)) {
      denied[toolId] = 'not_allowed_by_agent';
      continue;
    }
    if (!policyAllowed.has(toolId)) {
      denied[toolId] = 'not_allowed_by_policy';
      continue;
    }
    allowed.push(toolId);
  }

  return { allowed, denied };
}

export interface SkillEvalEvidence {
  passed: boolean;
  datasetVersion: string;
}

export type SkillPromotionDecision =
  | { kind: 'allow' }
  | { kind: 'deny'; reason: string };

const EVAL_GATED_STATES = new Set<SkillLifecycleState>(['APPROVED', 'SHADOW', 'CANARY', 'ACTIVE']);

export function evaluateSkillPromotion(input: {
  from: SkillLifecycleState;
  to: SkillLifecycleState;
  evalEvidence: SkillEvalEvidence | null;
}): SkillPromotionDecision {
  if (!canTransitionSkillLifecycle(input.from, input.to)) {
    return { kind: 'deny', reason: 'invalid_lifecycle_transition' };
  }

  if (EVAL_GATED_STATES.has(input.to)) {
    if (
      input.evalEvidence === null ||
      input.evalEvidence.passed !== true ||
      input.evalEvidence.datasetVersion.trim() === ''
    ) {
      return { kind: 'deny', reason: 'eval_evidence_required' };
    }
  }

  return { kind: 'allow' };
}

export function planSkillRollback(input: {
  skillName: string;
  currentVersionId: string;
  targetVersionId: string;
}): {
  kind: 'move_pointer';
  skillName: string;
  currentVersionId: string;
  targetVersionId: string;
} {
  return {
    kind: 'move_pointer',
    skillName: input.skillName,
    currentVersionId: input.currentVersionId,
    targetVersionId: input.targetVersionId,
  };
}
