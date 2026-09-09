import type { AgentDefinition } from '../contracts/agent-os';
import { ATENDIMENTO_AGENT_DEFINITION } from './atendimento';
import { CRM_OPERATOR_AGENT_DEFINITION } from './crm-operator';
import { isProductAgentId, type ProductAgentId } from './contracts';
import { ESCALATION_AGENT_DEFINITION } from './escalation';
import { GOVERNANCE_JUDGE_AGENT_DEFINITION } from './governance-judge';
import { RETENTION_AGENT_DEFINITION } from './retention';
import { SALES_AGENT_DEFINITION } from './sales';
import { SUPERVISOR_AGENT_DEFINITION } from './supervisor';

const DEFINITIONS: readonly [ProductAgentId, AgentDefinition][] = [
  ['supervisor', SUPERVISOR_AGENT_DEFINITION],
  ['atendimento', ATENDIMENTO_AGENT_DEFINITION],
  ['sales', SALES_AGENT_DEFINITION],
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
