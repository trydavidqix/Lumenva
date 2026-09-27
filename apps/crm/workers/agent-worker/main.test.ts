import { describe, expect, it, vi } from "vitest";

import { GraphitiContextProvider } from "@/lib/agent-engine/context/graphiti-context-provider";
import { Mem0ContextProvider } from "@/lib/agent-engine/context/mem0-context-provider";
import { loadEnv } from "@/lib/agent-engine/env";
import { createLogger } from "@/lib/agent-engine/obs/logger";

import { buildTurnDeps, registerNotificationDeliveryHandler, type JobHandler } from "./main";
import type { JobKind, JobRow } from "@/lib/agent-engine/queue/queue";
import type pg from "pg";

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

describe("worker registration — notification delivery", () => {
  it("registra o handler real e mantém o envio fechado por padrão", async () => {
    const env = loadEnv(REQUIRED);
    const handlers = new Map<JobKind, JobHandler>();
    registerNotificationDeliveryHandler(env, handlers);
    const handler = handlers.get("notification_delivery");
    const query = vi.fn();
    const job = {
      id: "job-1",
      organization_id: "org-1",
      contact_id: "contact-1",
      kind: "notification_delivery",
      payload: { notification_id: "33333333-3333-4333-8333-333333333333", phase: "initial" },
    } as unknown as JobRow;

    expect(handler).toBeTypeOf("function");
    await expect(handler?.(job, { query } as unknown as pg.Pool, { workerId: "test" })).rejects.toThrow(
      "notification_router_disabled",
    );
    expect(query).not.toHaveBeenCalled();
  });
});
