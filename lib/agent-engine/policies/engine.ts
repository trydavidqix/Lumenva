import type { PromotionDecision } from '../autonomy/promotion';
import type { AgentToolDefinition } from '../tools/registry';

export type AgentAutonomyLevel =
  | 'off'
  | 'shadow'
  | 'draft'
  | 'assisted'
  | 'autopilot_low_risk'
  | 'autopilot_expanded';

export type PolicyDecision =
  | { kind: 'allow' }
  | { kind: 'deny'; reason: string }
  | { kind: 'draft'; reason: 'draft_side_effects_disabled' }
  | {
      kind: 'require_approval';
      reason: string;
      approvalType: string;
    };

export interface ToolPolicyOverrides {
  deniedToolIds?: readonly string[];
  approvalToolIds?: readonly string[];
}

export interface EvaluateToolPolicyInput {
  organizationId: string;
  agentId: string;
  autonomyLevel: AgentAutonomyLevel;
  tool: AgentToolDefinition;
  tenantPolicy?: ToolPolicyOverrides;
  agentPolicy?: ToolPolicyOverrides;
  promotionDecision?: PromotionDecision;
}

function includesTool(ids: readonly string[] | undefined, toolId: string): boolean {
  return ids?.includes(toolId) ?? false;
}

function approval(reason: string, approvalType: string): PolicyDecision {
  return { kind: 'require_approval', reason, approvalType };
}

export function evaluateToolPolicy(input: EvaluateToolPolicyInput): PolicyDecision {
  const tenantPolicy = input.tenantPolicy ?? {};
  const agentPolicy = input.agentPolicy ?? {};

  if (includesTool(tenantPolicy.deniedToolIds, input.tool.id)) {
    return { kind: 'deny', reason: 'tool_denied_by_tenant_policy' };
  }
  if (includesTool(agentPolicy.deniedToolIds, input.tool.id)) {
    return { kind: 'deny', reason: 'tool_denied_by_agent_policy' };
  }

  if (input.tool.risk === 'r4_destructive_admin') {
    return { kind: 'deny', reason: 'r4_requires_human' };
  }

  if (input.autonomyLevel === 'draft' && input.tool.risk !== 'r0_read') {
    return { kind: 'draft', reason: 'draft_side_effects_disabled' };
  }

  if (
    includesTool(tenantPolicy.approvalToolIds, input.tool.id) ||
    includesTool(agentPolicy.approvalToolIds, input.tool.id)
  ) {
    return approval('tool_requires_explicit_approval', 'tool_execution');
  }

  if (input.tool.risk === 'r3_sensitive_commercial') {
    return approval('sensitive_commercial_requires_approval', 'sensitive_commercial');
  }

  switch (input.autonomyLevel) {
    case 'off':
      return { kind: 'deny', reason: 'autonomy_off' };

    case 'shadow':
      return input.tool.risk === 'r0_read'
        ? { kind: 'allow' }
        : { kind: 'deny', reason: 'shadow_side_effects_disabled' };

    case 'draft':
      return { kind: 'allow' };

    case 'assisted':
      if (input.tool.risk === 'r0_read') return { kind: 'allow' };
      if (input.tool.risk === 'r1_reversible_write') {
        return input.promotionDecision?.kind === 'allow'
          ? { kind: 'allow' }
          : { kind: 'deny', reason: 'promotion_evidence_required' };
      }
      return approval('autonomy_level_requires_approval', 'external_communication');

    case 'autopilot_low_risk':
      if (input.tool.risk === 'r0_read' || input.tool.risk === 'r1_reversible_write') {
        return { kind: 'allow' };
      }
      return approval('autonomy_level_requires_approval', 'external_communication');

    case 'autopilot_expanded':
      return { kind: 'allow' };
  }
}
