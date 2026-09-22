import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

export type InstructionRuntime = "codex" | "claude" | "gemini" | "generic";

export type InstructionSource = {
  name: string;
  path: string;
  scope: string;
  content: string;
};

export type InstructionPacket = {
  runtime: InstructionRuntime;
  sources: InstructionSource[];
  combined: string;
  characterCount: number;
  contextVersion: string;
};

export function resolveInstructions(input: {
  rootDir: string;
  targetPath: string;
  runtime: InstructionRuntime;
  doctrine?: string;
  budgetChars?: number;
}): InstructionPacket {
  const rootDir = resolve(input.rootDir);
  const target = resolve(rootDir, input.targetPath);
  const targetDir = existsSync(target) && statSync(target).isDirectory() ? target : dirname(target);
  const pathFromRoot = relative(rootDir, targetDir);
  if (pathFromRoot.startsWith("..") || pathFromRoot.includes("..")) {
    throw new Error("Instruction target must stay inside rootDir");
  }

  const sources: InstructionSource[] = [];
  if (input.doctrine) {
    sources.push({ name: "Lumenva Doctrine", path: "<doctrine>", scope: "universal", content: input.doctrine });
  }

  const directories = [rootDir, ...pathFromRoot.split(/[\\/]/).filter(Boolean).map((_, index, parts) => resolve(rootDir, ...parts.slice(0, index + 1)))];
  const names = instructionNames(input.runtime);
  for (const directory of directories) {
    for (const name of names) {
      const path = resolve(directory, name);
      if (!existsSync(path)) continue;
      sources.push({ name, path, scope: relative(rootDir, directory) || ".", content: readFileSync(path, "utf8") });
    }
  }

  const budget = Math.max(0, Math.floor(input.budgetChars ?? Number.POSITIVE_INFINITY));
  const combined = combineWithinBudget(sources, budget);
  return {
    runtime: input.runtime,
    sources,
    combined,
    characterCount: combined.length,
    contextVersion: createHash("sha256").update(JSON.stringify({ runtime: input.runtime, sources, combined })).digest("hex"),
  };
}

function instructionNames(runtime: InstructionRuntime): string[] {
  if (runtime === "claude") return ["AGENTS.md", "CLAUDE.md"];
  if (runtime === "gemini") return ["AGENTS.md", "GEMINI.md"];
  return ["AGENTS.md"];
}

function combineWithinBudget(sources: InstructionSource[], budget: number): string {
  if (!Number.isFinite(budget)) return sources.map(render).join("\n");
  let remaining = budget;
  const blocks: string[] = [];
  for (const source of sources) {
    if (remaining <= 0) break;
    const block = render(source);
    const bounded = block.slice(0, remaining);
    blocks.push(bounded);
    remaining -= bounded.length;
  }
  return blocks.join("\n").slice(0, budget);
}

function render(source: InstructionSource): string {
  return `## ${source.name} [${source.scope}]\n${source.content}`;
}
