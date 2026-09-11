import { createHash } from "node:crypto";

export type ContextPriority = "P0" | "P1" | "P2";

export interface ContextItemInput {
  readonly block: number;
  readonly priority: ContextPriority;
  readonly kind: string;
  readonly content: string;
}

export interface ContextItem {
  readonly block: number;
  readonly priority: ContextPriority;
  readonly kind: string;
  readonly content?: string;
  readonly promptHash?: string;
}

export interface ContextBuildInput {
  readonly promptHash: string;
  readonly items: readonly ContextItemInput[];
  readonly tokenBudget?: number;
}

export interface ContextPackage {
  readonly items: readonly ContextItem[];
  readonly contextHash: string;
  readonly tokenBudget?: number;
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, nested]) => JSON.stringify(key) + ":" + canonical(nested))
      .join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}

export function buildContext(input: ContextBuildInput): ContextPackage {
  if (!/^[a-f0-9]{64}$/.test(input.promptHash)) throw new Error("E_CONTEXT_PROMPT_HASH_REQUIRED");
  if (input.tokenBudget !== undefined && input.tokenBudget <= 0) throw new Error("E_CONTEXT_BUDGET_INVALID");
  const seen = new Set<number>();
  const ordered = [...input.items].sort((left, right) => left.block - right.block);
  const items: ContextItem[] = ordered.map((item) => {
    if (!Number.isInteger(item.block) || item.block < 1 || item.block > 20) throw new Error("E_CONTEXT_BLOCK_INVALID");
    if (seen.has(item.block)) throw new Error("E_CONTEXT_BLOCK_DUPLICATE");
    seen.add(item.block);
    if (!item.kind.trim() || !item.content.trim()) throw new Error("E_CONTEXT_ITEM_REQUIRED");
    return item.block <= 8
      ? { block: item.block, priority: item.priority, kind: item.kind, promptHash: input.promptHash }
      : { block: item.block, priority: item.priority, kind: item.kind, content: item.content.trim() };
  });
  return {
    items,
    ...(input.tokenBudget === undefined ? {} : { tokenBudget: input.tokenBudget }),
    contextHash: hash(canonical({ promptHash: input.promptHash, items, tokenBudget: input.tokenBudget })),
  };
}
