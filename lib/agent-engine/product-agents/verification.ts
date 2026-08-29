import type { KernelVerificationPort } from '../kernel/ports';
import { validateAtendimentoRecommendation } from './atendimento';
import { validateCrmMutationProposal } from './crm-operator';
import { isProductAgentId } from './contracts';
import { validateEscalationDecision } from './escalation';
import { validateGovernanceJudgement } from './governance-judge';
import { validateRetentionRecommendation } from './retention';
import { validateSalesRecommendation } from './sales';
import { validateSupervisorHandoffDecision } from './contracts';

type ProductValidation = { ok: true } | { ok: false; reason: string };

function validateProductOutput(agentId: string, output: unknown): ProductValidation {
  switch (agentId) {
    case 'supervisor': {
      const result = validateSupervisorHandoffDecision(output);
      return result.ok ? { ok: true } : { ok: false, reason: result.reason };
    }
    case 'atendimento':
      return validateAtendimentoRecommendation(output);
    case 'sales':
      return validateSalesRecommendation(output);
    case 'retention':
      return validateRetentionRecommendation(output);
    case 'escalation':
      return validateEscalationDecision(output);
    case 'crm_operator':
      return validateCrmMutationProposal(output);
    case 'governance_judge':
      return validateGovernanceJudgement(output);
    default:
      return { ok: false, reason: 'unknown_product_agent' };
  }
}

export function createProductAgentVerificationPort(): KernelVerificationPort {
  return {
    async verify({ execution, output }) {
      if (!isProductAgentId(execution.agentId)) {
        return { passed: false, evidence: 'product_output_invalid:unknown_product_agent' };
      }

      const validation = validateProductOutput(execution.agentId, output);
      if (!validation.ok) {
        return {
          passed: false,
          evidence: `product_output_invalid:${execution.agentId}:${validation.reason}`,
        };
      }

      return {
        passed: true,
        evidence: `product_output_valid:${execution.agentId}:${execution.agentVersion}`,
      };
    },
  };
}
