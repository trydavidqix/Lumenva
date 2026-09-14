import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readRepo = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("free/local voice worker architecture", () => {
  it("does not depend on paid STT/TTS providers in the production worker", () => {
    const worker = readRepo("workers/voice-worker/main.mjs");
    const readme = readRepo("workers/voice-worker/README.md");

    for (const forbidden of [
      "DeepgramSTT",
      "ElevenLabsTTS",
      "DEEPGRAM_API_KEY",
      "ELEVENLABS_API_KEY",
      "ELEVENLABS_VOICE_ID",
    ]) {
      expect(worker).not.toContain(forbidden);
      expect(readme).not.toContain(forbidden);
    }
  });

  it("uses Patter with explicit local Silero VAD and local speech adapters", () => {
    const worker = readRepo("workers/voice-worker/main.mjs");

    expect(worker).toContain("Patter");
    expect(worker).toContain("SileroVAD");
    expect(worker).toContain("SileroVAD.forPhoneCall");
    expect(worker).toContain("SpeachesFasterWhisperSTT");
    expect(worker).toContain("SpeachesLocalTTS");
    expect(worker).toContain("VOICE_LOCAL_SPEECH_URL");
  });

  it("keeps Lumenva as the brain and Patter as a media shell", () => {
    const worker = readRepo("workers/voice-worker/main.mjs");

    expect(worker).toContain("brain.runTurn");
    expect(worker).toContain('systemPrompt: "You are the Lumenva media shell. Business reasoning is provided externally."');
    expect(worker).not.toContain("runModelCall");
    expect(worker).not.toContain("customer_memory");
    expect(worker).toContain("persist: false");
    expect(worker).toContain("telemetry: false");
  });

  it("pins the Patter Silero native runtime dependency", () => {
    const pkg = JSON.parse(readRepo("workers/voice-worker/package.json")) as {
      dependencies?: Record<string, string>;
    };
    const dockerfile = readRepo("workers/voice-worker/Dockerfile");

    expect(pkg.dependencies?.getpatter).toBe("0.7.1");
    expect(pkg.dependencies?.["onnxruntime-node"]).toMatch(/^~1\.18\./);
    expect(dockerfile).toContain("node:22-bookworm-slim");
  });
});
