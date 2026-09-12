import type { AgentDefinition } from "./agent-definition";

const section = (heading: string, body: string): string => `# ${heading}\n\n${body}`;

export function compileSystemPrompt(definition: AgentDefinition): string {
  if (definition.status !== "CERTIFIED") {
    throw new Error("agent_definition_not_certified");
  }

  return [
    section("IDENTITY", definition.identity.trim()),
    section("MISSION", definition.mission.trim()),
    section("BOUNDARIES", definition.boundaries.map((boundary) => `- ${boundary.trim()}`).join("\n")),
    section("AUTHORITY", definition.authority.trim()),
    section("ESCALATION", definition.escalation.trim()),
  ].join("\n\n");
}
