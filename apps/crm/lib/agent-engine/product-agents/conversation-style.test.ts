import { describe, expect, it } from "vitest";

import { getProductAgentDefinition } from "./definitions";
import { resolveAgentConversationStyle } from "./conversation-style";

describe("Product Agent conversation styles", () => {
  it("keeps atendimento warm, patient and calm on its canonical definition", () => {
    const style = resolveAgentConversationStyle(getProductAgentDefinition("atendimento"));
    expect(style.register).toBe("warm");
    expect(style.toneInstructions.toLowerCase()).toContain("patient");
    expect(style.toneInstructions.toLowerCase()).toContain("calm");
  });

  it("keeps sales confident without becoming pushy on its canonical definition", () => {
    const style = resolveAgentConversationStyle(getProductAgentDefinition("sales"));
    expect(style.register).toBe("warm");
    expect(style.toneInstructions.toLowerCase()).toContain("confident");
    expect(style.toneInstructions.toLowerCase()).toContain("pressure");
  });

  it("keeps retention empathetic and non-defensive on its canonical definition", () => {
    const style = resolveAgentConversationStyle(getProductAgentDefinition("retention"));
    expect(style.register).toBe("warm");
    expect(style.toneInstructions.toLowerCase()).toContain("empathetic");
    expect(style.toneInstructions.toLowerCase()).toContain("non-defensive");
  });

  it("returns a safe professional style when a definition has no explicit personality", () => {
    const style = resolveAgentConversationStyle(getProductAgentDefinition("supervisor"));
    expect(style.register).toBe("professional");
  });

  it("stores the personality on AgentDefinition instead of a parallel id registry", () => {
    expect(getProductAgentDefinition("atendimento")?.conversationStyle?.register).toBe("warm");
    expect(getProductAgentDefinition("sales")?.conversationStyle?.register).toBe("warm");
    expect(getProductAgentDefinition("retention")?.conversationStyle?.register).toBe("warm");
  });
});
