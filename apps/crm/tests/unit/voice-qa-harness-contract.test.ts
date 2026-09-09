import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("voice QA harness contract", () => {
  it("keeps the provider-free gate explicit and runs the real SIP smoke processes", () => {
    const script = read("scripts/verify-voice-qa.sh");
    expect(script).toContain('MODE="${1:-provider-free}"');
    expect(script).toContain("ari-listener.smoke.mjs");
    expect(script).toContain("main.smoke.mjs");
    expect(script).toContain("VERIFIED PROVIDER-FREE");
  });

  it("refuses live execution without an explicit operator authorization", () => {
    const script = read("scripts/verify-voice-qa.sh");
    expect(script).toContain("VOICE_QA_ALLOW_LIVE");
    expect(script).toContain("NOT_EXECUTED");
    expect(script).toContain("never claims live proof");
  });

  it("documents health, metrics, rollback, and the evidence boundary", () => {
    const runbook = read("docs/runbooks/voice-qa.md");
    expect(runbook).toContain("/healthz");
    expect(runbook).toContain("processedEvents");
    expect(runbook).toContain("rollback");
    expect(runbook).toContain("NOT_PROVEN");
    expect(runbook).toContain("áudio de IA");
  });
});
