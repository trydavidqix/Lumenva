import { describe, expect, it } from "vitest";

import { AGENT_MODELS, agentModelSchema } from "@/lib/ai/guardrails-schema";

describe("agent models", () => {
  it("accepts the canonical OpenAI models in the agent model schema", () => {
    expect(AGENT_MODELS).toContain("openai/gpt-5.6-terra");
    expect(AGENT_MODELS).toContain("openai/gpt-5-mini");
    expect(agentModelSchema.parse("openai/gpt-5.6-terra")).toBe("openai/gpt-5.6-terra");
    expect(agentModelSchema.parse("openai/gpt-5-mini")).toBe("openai/gpt-5-mini");
  });
});
