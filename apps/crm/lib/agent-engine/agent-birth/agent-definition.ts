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

export function validateAgentDefinition(input: unknown): AgentDefinitionValidation {
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
