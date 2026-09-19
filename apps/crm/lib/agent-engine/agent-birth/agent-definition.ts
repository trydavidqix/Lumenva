export const AGENT_DEFINITION_STATUSES = ["SHADOW", "CERTIFIED"] as const;

export type AgentDefinitionStatus = (typeof AGENT_DEFINITION_STATUSES)[number];

export type AgentDefinitionInput = {
  id: string;
  version: string;
  identity: string;
  mission: string;
  boundaries: readonly string[];
  authority: string;
  escalation: string;
};

export type AgentDefinitionOrigin = {
  actor_id: string;
  tenant_id: string;
};

export type AgentDefinitionApproval = {
  approval_id: string;
  approver_id: string;
  tenant_id: string;
  status: "APPROVED" | "DENIED";
  approved_at: string;
  policy_version: string;
};

export type AgentBirthContext = {
  origin: AgentDefinitionOrigin;
  expected_tenant_id: string;
  approval?: AgentDefinitionApproval;
};

export type AgentDefinition = AgentDefinitionInput & {
  status: AgentDefinitionStatus;
};

export type AgentDefinitionValidation =
  | {
      ok: true;
      status: "CERTIFIED";
      definition: AgentDefinitionInput;
      errors: [];
    }
  | {
      ok: false;
      status: "SHADOW";
      definition: null;
      errors: string[];
    };

export type AgentCertification =
  | {
      ok: true;
      status: "CERTIFIED";
      definition: AgentDefinition;
      errors: [];
    }
  | {
      ok: false;
      status: "SHADOW";
      definition: null;
      errors: string[];
    };

const REQUIRED_TEXT_FIELDS = [
  "id",
  "version",
  "identity",
  "mission",
  "authority",
  "escalation",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateOrigin(origin: unknown, expectedTenantId: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(origin)) {
    return ["origin_required"];
  }
  if (!hasText(origin.actor_id)) errors.push("origin_actor_required");
  if (!hasText(origin.tenant_id)) errors.push("origin_tenant_required");
  if (errors.length === 0 && !hasText(expectedTenantId)) {
    errors.push("context_tenant_required");
  }
  if (
    errors.length === 0 &&
    (origin.tenant_id as string).trim() !== (expectedTenantId as string).trim()
  ) {
    errors.push("origin_tenant_mismatch");
  }
  return errors;
}

export function validateAgentDefinition(
  input: unknown,
  origin: AgentDefinitionOrigin,
  expectedTenantId: string,
): AgentDefinitionValidation {
  const originErrors = validateOrigin(origin, expectedTenantId);
  if (originErrors.length > 0) {
    return { ok: false, status: "SHADOW", definition: null, errors: originErrors };
  }

  if (!isRecord(input)) {
    return { ok: false, status: "SHADOW", definition: null, errors: ["definition_required"] };
  }

  const errors: string[] = [];
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (!hasText(input[field])) errors.push(`${field}_required`);
  }

  const boundaries = input.boundaries;
  if (
    !Array.isArray(boundaries) ||
    boundaries.length === 0 ||
    boundaries.some((boundary) => !hasText(boundary))
  ) {
    errors.push("boundaries_required");
  }

  if (errors.length > 0) {
    return { ok: false, status: "SHADOW", definition: null, errors };
  }

  const definition: AgentDefinitionInput = {
    id: input.id as string,
    version: input.version as string,
    identity: input.identity as string,
    mission: input.mission as string,
    boundaries: (boundaries as string[]).map((boundary) => boundary.trim()),
    authority: input.authority as string,
    escalation: input.escalation as string,
  };

  return { ok: true, status: "CERTIFIED", definition, errors: [] };
}

function validateApproval(
  approval: AgentDefinitionApproval | undefined,
  origin: AgentDefinitionOrigin,
  expectedTenantId: string,
): string[] {
  if (!approval) return ["approval_required"];
  const errors: string[] = [];
  if (!hasText(approval.approval_id)) errors.push("approval_id_required");
  if (!hasText(approval.approver_id)) errors.push("approver_required");
  if (!hasText(approval.policy_version)) errors.push("approval_policy_required");
  if (!hasText(approval.approved_at) || !Number.isFinite(Date.parse(approval.approved_at))) {
    errors.push("approval_timestamp_invalid");
  }
  if (approval.status !== "APPROVED") errors.push("approval_not_granted");
  if (!hasText(approval.tenant_id)) errors.push("approval_tenant_required");
  else if (approval.tenant_id.trim() !== expectedTenantId.trim()) errors.push("approval_tenant_mismatch");
  if (hasText(approval.approver_id) && approval.approver_id.trim() === origin.actor_id.trim()) {
    errors.push("approval_independence_required");
  }
  return errors;
}

/** Trusted caller boundary: only this function may turn a validated birth into CERTIFIED. */
export function certifyAgentDefinition(
  input: unknown,
  context: AgentBirthContext,
): AgentCertification {
  if (!isRecord(context)) {
    return { ok: false, status: "SHADOW", definition: null, errors: ["birth_context_required"] };
  }
  if (isRecord(input) && "status" in input && input.status !== "CERTIFIED") {
    return { ok: false, status: "SHADOW", definition: null, errors: ["agent_definition_not_certified"] };
  }
  const validation = validateAgentDefinition(input, context.origin, context.expected_tenant_id);
  if (!validation.ok) return validation;
  const approvalErrors = validateApproval(context.approval, context.origin, context.expected_tenant_id);
  if (approvalErrors.length > 0) {
    return { ok: false, status: "SHADOW", definition: null, errors: approvalErrors };
  }
  return {
    ok: true,
    status: "CERTIFIED",
    definition: { ...validation.definition, status: "CERTIFIED" },
    errors: [],
  };
}

