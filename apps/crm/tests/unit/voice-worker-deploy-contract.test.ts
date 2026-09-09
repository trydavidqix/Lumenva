import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("voice worker deployment contract", () => {
  it("ships a container healthcheck against the private control health endpoint", () => {
    const dockerfile = read("workers/voice-worker/Dockerfile");
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain("/healthz");
    expect(dockerfile).toContain("VOICE_CONTROL_PORT");
    expect(dockerfile).toContain("USER node");
  });

  it("disconnects Patter and closes the control server on process termination", () => {
    const main = read("workers/voice-worker/main.mjs");
    expect(main).toContain('process.once("SIGTERM"');
    expect(main).toContain('process.once("SIGINT"');
    expect(main).toContain("controlServer.close");
    expect(main).toContain("await phone.disconnect()");
  });
});
