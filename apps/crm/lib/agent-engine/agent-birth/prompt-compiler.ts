import type { AgentDefinition } from "./agent-definition";

function escapeDelimitedText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const section = (tag: string, body: string): string => `<${tag}>\n${body}\n</${tag}>`;

export function compileSystemPrompt(definition: AgentDefinition): string {
  if (definition.status !== "CERTIFIED") {
    throw new Error("agent_definition_not_certified");
  }

  return [
    section("agent_identity", escapeDelimitedText(definition.identity.trim())),
    section("agent_mission", escapeDelimitedText(definition.mission.trim())),
    section(
      "agent_boundaries",
      definition.boundaries
        .map((boundary) => section("boundary", escapeDelimitedText(boundary.trim())))
        .join("\n"),
    ),
    section("agent_authority", escapeDelimitedText(definition.authority.trim())),
    section("agent_escalation", escapeDelimitedText(definition.escalation.trim())),
  ].join("\n");
}
