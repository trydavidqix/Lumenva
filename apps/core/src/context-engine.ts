import { createHash } from "node:crypto";
import type { DelegationContext } from "@lumenva/operating-core";
import type { ToolCatalog } from "./tool-registry.js";

export type TaskContract = {
  taskId: string;
  goal: string;
  scope: string;
  allowedPaths: string[];
  constraints: string[];
  capabilities: string[];
  risk: "low" | "medium" | "high" | "critical";
  baseSha: string;
  contextBudget: number;
  toolBudget: number;
  executionBudget: number;
  preferredProvider: string;
  evidenceRequired: boolean;
};

export type ContextCandidate = {
  path: string;
  symbols: string[];
  content: string;
  score: number;
};

export type ContextLevel = 0 | 1 | 2;

export type ContextFile = {
  path: string;
  symbols: string[];
  score: number;
  excerpt?: string;
};

export type ContextPacket = {
  taskId: string;
  contextVersion: string;
  level: ContextLevel;
  objective: string;
  relevantInstructions: string[];
  relevantFiles: ContextFile[];
  relevantSymbols: string[];
  priorDecisions: string[];
  constraints: string[];
  availableTools: string[];
  mcpCatalogVersion?: string;
  evidence: string[];
  tokenBudget: number;
  characterCount: number;
};

export function toDelegationContext(packet: ContextPacket): DelegationContext {
  return {
    packet_id: `packet:${packet.contextVersion}`,
    task_id: packet.taskId,
    context_version: packet.contextVersion,
    level: packet.level,
    objective: packet.objective,
    relevant_instructions: [...packet.relevantInstructions],
    relevant_files: packet.relevantFiles.map((file) => ({
      path: file.path,
      symbols: [...file.symbols],
      score: file.score,
      ...(file.excerpt !== undefined ? { excerpt: file.excerpt } : {}),
    })),
    relevant_symbols: [...packet.relevantSymbols],
    prior_decisions: [...packet.priorDecisions],
    constraints: [...packet.constraints],
    available_tools: [...packet.availableTools],
    ...(packet.mcpCatalogVersion ? { mcp_catalog_version: packet.mcpCatalogVersion } : {}),
    evidence: [...packet.evidence],
    token_budget: packet.tokenBudget,
    character_count: packet.characterCount,
  };
}

export type ProgressiveContextRetriever = {
  symbols(task: TaskContract): Promise<ContextCandidate[]>;
  excerpts(task: TaskContract, candidates: ContextCandidate[]): Promise<ContextCandidate[]>;
};

export async function resolveProgressiveContext(input: {
  task: TaskContract;
  retriever: ProgressiveContextRetriever;
  instructions?: string[];
  toolCatalog?: Pick<ToolCatalog, "tools">;
  needsMoreContext?: (packet: ContextPacket) => boolean | Promise<boolean>;
}): Promise<ContextPacket> {
  const needsMoreContext = input.needsMoreContext ?? (() => true);
  let packet = resolveContext({ task: input.task, level: 0, instructions: input.instructions, toolCatalog: input.toolCatalog });
  if (!(await needsMoreContext(packet))) return packet;

  const candidates = await input.retriever.symbols(input.task);
  packet = resolveContext({ task: input.task, candidates, level: 1, instructions: input.instructions, toolCatalog: input.toolCatalog });
  if (!(await needsMoreContext(packet))) return packet;

  const enrichedCandidates = await input.retriever.excerpts(input.task, candidates);
  return resolveContext({ task: input.task, candidates: enrichedCandidates, level: 2, instructions: input.instructions, toolCatalog: input.toolCatalog });
}

export function resolveContext(input: {
  task: TaskContract;
  candidates?: ContextCandidate[];
  level?: ContextLevel;
  instructions?: string[];
  toolCatalog?: Pick<ToolCatalog, "tools">;
}): ContextPacket {
  const { task, level = 0 } = input;
  const budget = Math.max(0, Math.floor(task.contextBudget));
  const candidates = deduplicateCandidates((input.candidates ?? [])
    .filter((candidate) => isAllowedPath(candidate.path, task.allowedPaths)))
    .sort(compareCandidates);
  const objective = take(task.goal, budget);
  const constraints = boundedList(task.constraints, Math.max(0, budget - objective.length));
  const instructions = boundedList(input.instructions ?? [], Math.max(0, budget - characterCount(objective, constraints, [])));
  const files = level === 0 ? [] : candidates.map((candidate) => ({
    path: candidate.path,
    symbols: [...candidate.symbols].sort(),
    score: candidate.score,
    ...(level >= 2 ? { excerpt: "" } : {}),
  }));
  const symbols = level === 0
    ? []
    : unique(files.flatMap((file) => file.symbols)).sort();

  if (level >= 2) {
    let remaining = Math.max(0, budget - characterCount(objective, [...constraints, ...instructions], []));
    for (const [index, candidate] of candidates.entries()) {
      const excerpt = take(candidate.content, remaining);
      files[index] = { ...files[index], excerpt };
      remaining -= excerpt.length;
    }
  }

  const packetBody = {
    taskId: task.taskId,
    level,
    objective,
    relevantInstructions: instructions,
    relevantFiles: files,
    relevantSymbols: symbols,
    priorDecisions: [],
    constraints,
    availableTools: input.toolCatalog ? input.toolCatalog.tools.map((tool) => tool.name) : [...task.capabilities].sort(),
    evidence: [],
    tokenBudget: task.contextBudget,
  };
  const serialized = JSON.stringify(packetBody);
  return {
    ...packetBody,
    contextVersion: createHash("sha256").update(serialized).digest("hex"),
    characterCount: characterCount(objective, [...constraints, ...instructions], files),
  };
}

function compareCandidates(left: ContextCandidate, right: ContextCandidate): number {
  return right.score - left.score || left.path.localeCompare(right.path);
}

function deduplicateCandidates(candidates: ContextCandidate[]): ContextCandidate[] {
  const unique = new Map<string, ContextCandidate>();
  for (const candidate of candidates) {
    const key = createHash("sha256").update(candidate.content).digest("hex");
    const current = unique.get(key);
    if (!current || compareCandidates(candidate, current) < 0) unique.set(key, candidate);
  }
  return [...unique.values()];
}

function isAllowedPath(path: string, allowedPaths: string[]): boolean {
  return allowedPaths.some((allowed) => path === allowed || path.startsWith(`${allowed}/`));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function boundedList(values: string[], budget: number): string[] {
  const result: string[] = [];
  let remaining = budget;
  for (const value of values) {
    if (remaining <= 0) break;
    const bounded = take(value, remaining);
    result.push(bounded);
    remaining -= bounded.length;
  }
  return result;
}

function take(value: string, count: number): string {
  return value.slice(0, Math.max(0, count));
}

function characterCount(objective: string, constraints: string[], files: ContextFile[]): number {
  return objective.length
    + constraints.reduce((total, value) => total + value.length, 0)
    + files.reduce((total, file) => total + (file.excerpt?.length ?? 0), 0);
}
