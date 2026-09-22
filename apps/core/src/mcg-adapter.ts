export type ContextRequest = {
  taskId: string;
  traceId: string;
  objective: string;
  budgetChars: number;
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
      const result = compiler.compileContext({
        fragments: [{ id: `${request.taskId}:objective`, category: "must_keep", priority: 100, content: request.objective }],
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
