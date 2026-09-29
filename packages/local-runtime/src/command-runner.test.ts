import { mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CommandPolicyError, SafeCommandRunner, redactRuntimeText } from "./command-runner.js";
import type { RuntimeCommand } from "./contracts.js";

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "lumenva-runtime-")));
  const runner = new SafeCommandRunner({
    workspaceRoots: [root],
    allowedExecutables: [basenameForNode(process.execPath)],
    allowedEnv: [],
  });
  const command: RuntimeCommand = {
    id: "cmd",
    correlation: { organizationId: "org", traceId: "trace" },
    capabilityId: "test",
    executable: process.execPath,
    args: ["-e", "process.stdout.write('ok')"],
    cwd: root,
    timeoutMs: 2_000,
    maxOutputBytes: 1024,
    risk: "R0",
  };
  return { root, runner, command };
}

function basenameForNode(path: string): string {
  return path.replaceAll("\\", "/").split("/").at(-1) ?? path;
}

describe("SafeCommandRunner", () => {
  it("runs an allowlisted executable without a shell", async () => {
    const { runner, command } = await fixture();
    const result = await runner.run(command);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("ok");
  });

  it("fails closed for executables outside the allowlist", async () => {
    const { root, command } = await fixture();
    const runner = new SafeCommandRunner({ workspaceRoots: [root], allowedExecutables: [] });
    await expect(runner.run(command)).rejects.toMatchObject<Partial<CommandPolicyError>>({ code: "executable_denied" });
  });

  it("enforces the output cap", async () => {
    const { runner, command } = await fixture();
    const result = await runner.run({ ...command, args: ["-e", "process.stdout.write('x'.repeat(5000))"], maxOutputBytes: 100 });
    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(100);
  });

  it("times out bounded commands", async () => {
    const { runner, command } = await fixture();
    const result = await runner.run({ ...command, args: ["-e", "setTimeout(()=>{},5000)"], timeoutMs: 25 });
    expect(result.timedOut).toBe(true);
  });

  it("redacts common credential values", () => {
    expect(redactRuntimeText("Authorization: Bearer abcdefghijklmnop")).not.toContain("abcdefghijklmnop");
    expect(redactRuntimeText("token ghp_abcdefghijklmnopqrstuvwxyz")).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz");
  });
});
