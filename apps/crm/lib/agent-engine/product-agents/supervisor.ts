import type { AgentDefinition } from '../contracts/agent-os';
import {
  validateSupervisorHandoffDecision,
  type SupervisorHandoffDecision,
} from './contracts';

export const SUPERVISOR_AGENT_DEFINITION = {
  id: 'supervisor',
  version: '1.0.0',
  objective: 'Classify incoming work and recommend exactly one governed product-agent handoff.',
  autonomyLevel: 'shadow',
  allowedSkills: [],
  allowedTools: [],
  loop: {
    goal: 'Return one bounded specialist handoff decision or escalate safely.',
    maxSteps: 4,
    maxToolCalls: 1,
    maxTokens: 2_000,
    maxCostCents: 5,
    maxRuntimeMs: 15_000,
    repeatedToolLimit: 2,
    noProgressLimit: 2,
  },
  requiredModelCapabilities: ['structured_output'],
} as const satisfies AgentDefinition;

const SAFE_ESCALATION: SupervisorHandoffDecision = {
  targetAgent: 'escalation',
  reason: 'supervisor_output_invalid',
  confidence: 0,
  requiresHumanEscalation: true,
};

export function normalizeSupervisorHandoff(input: unknown): SupervisorHandoffDecision {
  const validation = validateSupervisorHandoffDecision(input);
  if (!validation.ok) return { ...SAFE_ESCALATION };
  return validation.value;
}
