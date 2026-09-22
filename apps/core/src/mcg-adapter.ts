import type { ContextPacket } from "./context-engine.js";
import type { BudgetLimits } from "./context-budget.js";

export type ContextRequest = {
  taskId: string;
  traceId: string;
  objective: string;
  budgetChars: number;
  packet?: ContextPacket;
  budgetLimits?: BudgetLimits;
};

export type ContextResult = {
  contextVersion: string;
  fragments: Array<{ id: string; content: string }>;
  measurementType: "exact" | "estimated" | "unavailable";
  source: string;
};

export type MgcAdapter = {
  compile(request: ContextRequest): Promise<ContextResult>;
};

export class MgcUnavailableError extends Error {
  readonly code = "MCG_UNAVAILABLE" as const;

  constructor(cause: unknown) {
    super(`MCG unavailable: ${cause instanceof Error ? cause.message : "adapter failure"}`);
    this.name = "MgcUnavailableError";
  }
}

type MgcCompilerModule = {
  compileContext(input: { fragments: Array<{ id: string; category: string; priority: number; content: string }>; budget_chars: number }): {
    context_version: string;
    fragments: Array<{ id: string; content: string }>;
    measurement_type: "estimated" | "exact" | "unavailable";
    source: string;
  };
};

export async function createLocalMgcAdapter(): Promise<MgcAdapter> {
  const moduleUrl = new URL("../../../packages/maestri-context-gateway/src/context/compiler.mjs", import.meta.url).href;
  const compiler = await import(moduleUrl) as unknown as MgcCompilerModule;
  return {
    async compile(request) {
      const fragments = [
        { id: `${request.taskId}:objective`, category: "must_keep", priority: 100, content: request.objective },
        ...(request.packet?.relevantFiles
          .filter((file) => Boolean(file.excerpt))
          .map((file) => ({ id: file.path, category: "relevant_file", priority: Math.round(file.score * 100), content: file.excerpt! })) ?? []),
      ];
      const result = compiler.compileContext({
        fragments,
        budget_chars: request.budgetChars,
      });
      return {
        contextVersion: result.context_version,
        fragments: result.fragments.map(({ id, content }) => ({ id, content })),
        measurementType: result.measurement_type,
        source: result.source,
      };
    },
  };
}
