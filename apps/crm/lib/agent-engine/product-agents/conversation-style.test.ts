import { describe, expect, it } from "vitest";

import { getProductAgentConversationStyle } from "./conversation-style";

describe("Product Agent conversation styles", () => {
  it("keeps atendimento warm, patient and calm", () => {
    const style = getProductAgentConversationStyle("atendimento");
    expect(style.register).toBe("warm");
    expect(style.toneInstructions.toLowerCase()).toContain("patient");
    expect(style.toneInstructions.toLowerCase()).toContain("calm");
  });

  it("keeps sales confident without becoming pushy", () => {
    const style = getProductAgentConversationStyle("sales");
    expect(style.register).toBe("warm");
    expect(style.toneInstructions.toLowerCase()).toContain("confident");
    expect(style.toneInstructions.toLowerCase()).toContain("pressure");
  });

  it("keeps retention empathetic and non-defensive", () => {
    const style = getProductAgentConversationStyle("retention");
    expect(style.register).toBe("warm");
    expect(style.toneInstructions.toLowerCase()).toContain("empathetic");
    expect(style.toneInstructions.toLowerCase()).toContain("non-defensive");
  });

  it("returns a safe professional style for non-conversational agents", () => {
    const style = getProductAgentConversationStyle("supervisor");
    expect(style.register).toBe("professional");
  });
});
