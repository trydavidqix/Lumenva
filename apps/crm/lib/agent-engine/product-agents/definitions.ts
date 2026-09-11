import type { AgentDefinition } from '../contracts/agent-os';
import { FIRST_BIRTH_CONTRACTS } from './birth';
import { isProductAgentId, type ProductAgentId } from './contracts';
import { ESCALATION_AGENT_DEFINITION } from './escalation';
import { GOVERNANCE_JUDGE_AGENT_DEFINITION } from './governance-judge';
import { RETENTION_AGENT_DEFINITION } from './retention';
import { CRM_OPERATOR_AGENT_DEFINITION } from './crm-operator';

const BORN_DEFINITIONS = new Map(
  FIRST_BIRTH_CONTRACTS.map((contract) => [contract.definition.id, contract.definition]),
);

function born(id: "sales" | "atendimento" | "supervisor"): AgentDefinition {
  const definition = BORN_DEFINITIONS.get(id);
  if (!definition) throw new Error(`missing_birth_definition:${id}`);
  return definition;
}

const DEFINITIONS: readonly [ProductAgentId, AgentDefinition][] = [
  ['supervisor', born('supervisor')],
  ['atendimento', born('atendimento')],
  ['sales', born('sales')],
  ['retention', RETENTION_AGENT_DEFINITION],
  ['escalation', ESCALATION_AGENT_DEFINITION],
  ['crm_operator', CRM_OPERATOR_AGENT_DEFINITION],
  ['governance_judge', GOVERNANCE_JUDGE_AGENT_DEFINITION],
];

export const PRODUCT_AGENT_DEFINITIONS: ReadonlyMap<ProductAgentId, AgentDefinition> = new Map(DEFINITIONS);

export function getProductAgentDefinition(id: unknown): AgentDefinition | null {
  if (!isProductAgentId(id)) return null;
  return PRODUCT_AGENT_DEFINITIONS.get(id) ?? null;
}
