import { GraphitiHttpClient } from "./graphiti-http.js";
import { NullKnowledgeGraph, type KnowledgeGraph } from "./graph.js";

export type GraphitiMode = "off" | "shadow" | "on";

export type GraphitiRuntimeStatus = {
  mode: GraphitiMode;
  provider: "null" | "graphiti";
  reason: "disabled" | "configured" | "invalid_configuration" | "invalid_mode";
};

export type GraphitiRuntime = {
  graph: KnowledgeGraph;
  status: GraphitiRuntimeStatus;
};

export function createKnowledgeGraphFromEnv(
  env: Record<string, string | undefined> = process.env,
): GraphitiRuntime {
  const rawMode = env.GRAPHITI_MODE?.trim().toLowerCase() || "off";
  if (rawMode !== "off" && rawMode !== "shadow" && rawMode !== "on") {
    return { graph: new NullKnowledgeGraph(), status: { mode: "off", provider: "null", reason: "invalid_mode" } };
  }

  const mode = rawMode as GraphitiMode;
  if (mode === "off") {
    return { graph: new NullKnowledgeGraph(), status: { mode, provider: "null", reason: "disabled" } };
  }

  const timeoutMs = Number(env.GRAPHITI_TIMEOUT_MS || "2000");
  if (!env.GRAPHITI_BASE_URL || !env.GRAPHITI_API_KEY || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return { graph: new NullKnowledgeGraph(), status: { mode, provider: "null", reason: "invalid_configuration" } };
  }

  try {
    return {
      graph: new GraphitiHttpClient({
        baseUrl: env.GRAPHITI_BASE_URL,
        apiKey: env.GRAPHITI_API_KEY,
        timeoutMs,
      }),
      status: { mode, provider: "graphiti", reason: "configured" },
    };
  } catch {
    return { graph: new NullKnowledgeGraph(), status: { mode, provider: "null", reason: "invalid_configuration" } };
  }
}
