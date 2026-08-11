import { describe, expect, it } from "vitest";

import { NoopAiTracer } from "./ai-tracing";

describe("NoopAiTracer", () => {
  it("accepts a complete span lifecycle without throwing", async () => {
    const tracer = new NoopAiTracer();

    const span = await tracer.startSpan({
      name: "agent_turn",
      runId: "00000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000002",
      metadata: { purpose: "reply" },
      input: { message: "Olá" },
    });

    await expect(span.end({
      output: { reply: "Olá, como posso ajudar?" },
      metrics: { latency_ms: 14 },
    })).resolves.toBeUndefined();
  });
});
