import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const configPath = fileURLToPath(new URL("../../vitest.config.ts", import.meta.url));

describe("Vitest / Node voice-worker boundary", () => {
  it("excludes Node's voice-worker tests regardless of runner root", () => {
    const source = readFileSync(configPath, "utf8");
    expect(source).toContain('"**/workers/voice-worker/**"');
  });
});
