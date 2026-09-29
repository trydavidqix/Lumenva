import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SafeCommandRunner } from "./command-runner.js";
import { ReadOnlyLocalExecutor } from "./read-executor.js";

describe("ReadOnlyLocalExecutor", () => {
  it("reads and searches only inside its workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "lumenva-read-"));
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "a.txt"), "needle");
    const runner = new SafeCommandRunner({ workspaceRoots: [root], allowedExecutables: ["git", "git.exe"] });
    const executor = new ReadOnlyLocalExecutor({ workspaceRoot: root, commandRunner: runner });
    expect((await executor.read("src/a.txt")).value).toBe("needle");
    expect((await executor.search("needle")).value).toEqual(["src/a.txt"]);
    await expect(executor.read("../outside.txt")).rejects.toThrow();
  });

  it("marks read operations deterministic R0", async () => {
    const root = await mkdtemp(join(tmpdir(), "lumenva-read-"));
    await writeFile(join(root, "a.txt"), "ok");
    const runner = new SafeCommandRunner({ workspaceRoots: [root], allowedExecutables: [] });
    const executor = new ReadOnlyLocalExecutor({ workspaceRoot: root, commandRunner: runner });
    expect(await executor.read("a.txt")).toMatchObject({ risk: "R0", deterministic: true });
  });

  it("rejects invalid ports", async () => {
    const root = await mkdtemp(join(tmpdir(), "lumenva-read-"));
    const runner = new SafeCommandRunner({ workspaceRoots: [root], allowedExecutables: [] });
    const executor = new ReadOnlyLocalExecutor({ workspaceRoot: root, commandRunner: runner });
    await expect(executor.portCheck("127.0.0.1", 0)).rejects.toThrow("runtime_port_invalid");
  });
});
