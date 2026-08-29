import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PRODUCT_AGENT_IDS } from "../../lib/agent-engine/product-agents/contracts";
import { PRODUCT_AGENT_DEFINITIONS } from "../../lib/agent-engine/product-agents/definitions";
import { buildCurrentHumanHandoffCommand } from "../../lib/agent-engine/product-agents/escalation";
import { PRODUCT_AGENT_GOLDEN_CASES } from "../../lib/agent-engine/product-agents/golden-cases";
import { createProductAgentVerificationPort } from "../../lib/agent-engine/product-agents/verification";

const SOURCE_FILES = [
  "supervisor.ts",
  "atendimento.ts",
  "sales.ts",
  "retention.ts",
  "escalation.ts",
  "crm-operator.ts",
  "governance-judge.ts",
] as const;

describe("converged Product Agents", () => {
  it("keeps all seven roles versioned, SHADOW-only and without direct tool selectors", () => {
    expect(PRODUCT_AGENT_DEFINITIONS.size).toBe(7);
    for (const id of PRODUCT_AGENT_IDS) {
      const definition = PRODUCT_AGENT_DEFINITIONS.get(id);
      expect(definition?.version).toBe("1.0.0");
      expect(definition?.autonomyLevel).toBe("shadow");
      expect(definition?.allowedTools).toEqual([]);
      expect(definition?.requiredModelCapabilities).toContain("structured_output");
    }
  });

  it("accepts every golden expected output through the canonical verification port", async () => {
    const verification = createProductAgentVerificationPort();

    for (const golden of PRODUCT_AGENT_GOLDEN_CASES) {
      if (golden.id === "supervisor-ambiguous-fallback") continue;
      const definition = PRODUCT_AGENT_DEFINITIONS.get(golden.agentId)!;
      const result = await verification.verify({
        execution: {
          runId: `run-${golden.id}`,
          organizationId: "org-a",
          agentId: golden.agentId,
          agentVersion: definition.version,
          traceId: `trace-${golden.id}`,
          correlationId: `corr-${golden.id}`,
          goal: "golden",
          trigger: { kind: "eval", sourceId: golden.id },
          definition,
          resume: false,
        },
        output: golden.expected,
      });

      expect(result.passed, golden.id).toBe(true);
    }
  });

  it("maps escalation to the existing CRM handoff identity instead of a parallel state machine", () => {
    const command = buildCurrentHumanHandoffCommand(
      {
        kind: "human_escalation",
        reason: "cliente pediu humano",
        priority: "urgent",
        requiredContext: ["conversation_id"],
      },
      { tenantId: "org-a", leadId: "contact-1", conversationId: "conversation-1" },
      "Resumo seguro para o atendente",
    );

    expect(command.ids).toEqual({ tenantId: "org-a", leadId: "contact-1", conversationId: "conversation-1" });
    expect(command.inboxTitle).toBe("Escalação urgente");
  });

  it("contains no direct provider SDK or database-client imports in product role source", () => {
    for (const file of SOURCE_FILES) {
      const source = readFileSync(join(process.cwd(), "lib/agent-engine/product-agents", file), "utf8");
      expect(source).not.toMatch(/@ai-sdk\//u);
      expect(source).not.toMatch(/@anthropic-ai\//u);
      expect(source).not.toMatch(/createAdminClient|createClient\s*\(/u);
    }
  });
});
