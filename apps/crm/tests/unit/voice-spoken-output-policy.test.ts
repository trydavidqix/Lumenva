import { describe, expect, it } from "vitest";
import { extractSpeakableVoiceText } from "@/lib/voice/runtime/agent-os-adapter";

describe("voice spoken-output hard policy", () => {
  it("speaks only bounded text fields", () => {
    expect(extractSpeakableVoiceText({ draft: "Olá" })).toBe("Olá");
    expect(extractSpeakableVoiceText({ draft: "x".repeat(4001), text: "fallback" })).toBe("fallback");
    expect(extractSpeakableVoiceText({ draft: "x".repeat(4001) })).toBeNull();
  });
});
