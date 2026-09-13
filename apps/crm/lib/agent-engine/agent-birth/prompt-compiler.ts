import {
  validateAgentDefinition,
  type AgentDefinition,
  type AgentDefinitionOrigin,
} from "./agent-definition";

function escapeDelimitedText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const section = (tag: string, body: string): string => `<${tag}>\n${body}\n</${tag}>`;

export function compileSystemPrompt(
  definition: AgentDefinition,
  origin: AgentDefinitionOrigin,
  expectedTenantId: string,
): string {
  const validation = validateAgentDefinition(definition, origin, expectedTenantId);
  if (!validation.ok || definition.status !== "CERTIFIED") {
    throw new Error("agent_definition_not_certified");
  }

  const certifiedDefinition = validation.definition;

  return [
    section("agent_identity", escapeDelimitedText(certifiedDefinition.identity.trim())),
    section("agent_mission", escapeDelimitedText(certifiedDefinition.mission.trim())),
    section(
      "agent_boundaries",
      certifiedDefinition.boundaries
        .map((boundary) => section("boundary", escapeDelimitedText(boundary.trim())))
        .join("\n"),
    ),
    section("agent_authority", escapeDelimitedText(certifiedDefinition.authority.trim())),
    section("agent_escalation", escapeDelimitedText(certifiedDefinition.escalation.trim())),
  ].join("\n");
}
