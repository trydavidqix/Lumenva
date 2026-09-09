import { describe, expect, it } from "vitest";

import { GraphitiContextProvider } from "@/lib/agent-engine/context/graphiti-context-provider";
import { Mem0ContextProvider } from "@/lib/agent-engine/context/mem0-context-provider";
import { loadEnv } from "@/lib/agent-engine/env";
import { createLogger } from "@/lib/agent-engine/obs/logger";

import { buildTurnDeps } from "./main";

const REQUIRED: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  SUPABASE_DB_URL: "postgresql://u:p@localhost:5432/db",
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};

/**
 * Regressão que este teste vigia: as duas chaves ficando `undefined` no
 * literal `turnDeps` (silenciosamente, sem erro de compilação) fazia
 * Mem0/Graphiti nunca serem consultados em produção mesmo com a feature
 * flag ligada — bug real encontrado em 2026-08-21, corrigido aqui.
 */
describe("buildTurnDeps — wiring de Mem0/Graphiti nunca fica undefined", () => {
  it("sem MEM0_BASE_URL/GRAPHITI_BASE_URL no env, ainda constrói os dois providers (cai pro Null port)", () => {
    const env = loadEnv(REQUIRED);
    const deps = buildTurnDeps(env, createLogger());

    expect(deps.semanticContextProvider).toBeInstanceOf(Mem0ContextProvider);
    expect(deps.graphContextProvider).toBeInstanceOf(GraphitiContextProvider);
  });

  it("com MEM0_BASE_URL/GRAPHITI_BASE_URL configurados, também constrói os dois providers", () => {
    const env = loadEnv({
      ...REQUIRED,
      MEM0_BASE_URL: "http://mem0:8000",
      MEM0_API_KEY: "m0-fake",
      GRAPHITI_BASE_URL: "http://graphiti:8000",
      GRAPHITI_API_KEY: "graphiti-fake",
    });
    const deps = buildTurnDeps(env, createLogger());

    expect(deps.semanticContextProvider).toBeInstanceOf(Mem0ContextProvider);
    expect(deps.graphContextProvider).toBeInstanceOf(GraphitiContextProvider);
  });
});
