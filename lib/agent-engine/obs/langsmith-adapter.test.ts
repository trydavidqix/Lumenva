import { describe, expect, it, vi } from "vitest";

import type { Logger } from "./logger";
import { LangSmithAiTracer, type LangSmithClient } from "./langsmith-adapter";

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000002";
const RUN_ID = "00000000-0000-4000-8000-000000000001";
const CHILD_RUN_ID = "00000000-0000-4000-8000-000000000003";
const API_KEY = "langsmith-api-key-that-must-not-be-logged";

function enabledConfig() {
  return {
    enabled: true as const,
    apiKey: API_KEY,
    endpoint: "https://api.smith.langchain.com",
    project: "deskcomm-test",
    workspaceId: "workspace-test",
  };
}

function warningLogger(warnings: Array<{ msg: string; fields?: Record<string, unknown> }>): Logger {
  return {
    info: () => undefined,
    warn: (msg, fields) => warnings.push({ msg, fields }),
    error: () => undefined,
  };
}

describe("LangSmithAiTracer", () => {
  it("keeps child spans distinct while correlating them to the parent trace", async () => {
    const createRun = vi.fn().mockResolvedValue(undefined);
    const updateRun = vi.fn().mockResolvedValue(undefined);
    const tracer = new LangSmithAiTracer({
      resolveConfig: vi.fn().mockResolvedValue(enabledConfig()),
      createClient: () => ({ createRun, updateRun }),
      now: () => new Date("2026-08-11T10:20:00.000Z"),
    });

    const parent = await tracer.startSpan({
      name: "agent_turn",
      runId: RUN_ID,
      traceId: RUN_ID,
      organizationId: ORGANIZATION_ID,
      metadata: { job_id: "job-safe" },
    } as never);
    const child = await tracer.startSpan({
      name: "llm_model_call",
      runId: CHILD_RUN_ID,
      traceId: RUN_ID,
      parentRunId: RUN_ID,
      organizationId: ORGANIZATION_ID,
      metadata: { job_id: "job-safe" },
    } as never);
    const dottedOrders = (tracer as unknown as { dottedOrders: Map<string, string> }).dottedOrders;
    expect(dottedOrders.size).toBe(2);
    await child.end({});
    expect(dottedOrders.has(RUN_ID)).toBe(true);
    expect(dottedOrders.has(CHILD_RUN_ID)).toBe(false);
    await parent.end({});
    expect(dottedOrders.size).toBe(0);

    expect(createRun.mock.calls.map(([run]) => run.id)).toEqual([RUN_ID, CHILD_RUN_ID]);
    expect(createRun.mock.calls.map(([run]) => run.trace_id)).toEqual([RUN_ID, RUN_ID]);
    const [parentRun] = createRun.mock.calls[0]!;
    const [childRun] = createRun.mock.calls[1]!;
    expect(childRun.parent_run_id).toBe(RUN_ID);
    expect(childRun.dotted_order.startsWith(`${parentRun.dotted_order}.`)).toBe(true);
    expect(updateRun.mock.calls.map(([runId]) => runId)).toEqual([CHILD_RUN_ID, RUN_ID]);
    expect(updateRun.mock.calls.map(([, run]) => run.trace_id)).toEqual([RUN_ID, RUN_ID]);
  });

  it("sanitizes span data before passing it to the LangSmith client", async () => {
    const createRun = vi.fn().mockResolvedValue(undefined);
    const updateRun = vi.fn().mockResolvedValue(undefined);
    const client: LangSmithClient = { createRun, updateRun };
    const createClient = vi.fn(() => client);
    const tracer = new LangSmithAiTracer({
      resolveConfig: vi.fn().mockResolvedValue(enabledConfig()),
      createClient,
      now: () => new Date("2026-08-11T10:20:00.000Z"),
    });

    const span = await tracer.startSpan({
      name: "agent reply for ana@example.test",
      runId: RUN_ID,
      organizationId: ORGANIZATION_ID,
      metadata: {
        customer_email: "ana@example.test",
        authorization: "Bearer top-secret-token",
      },
      input: {
        message: "Ligue para +351 912 345 678",
        api_key: "internal-api-key",
      },
    });
    await span.end({
      output: { email: "ana@example.test" },
      error: "Bearer top-secret-token",
      metrics: { latency_ms: 14 },
    });

    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: API_KEY,
      autoBatchTracing: true,
    }));
    expect(createRun).toHaveBeenCalledWith(expect.objectContaining({
      id: RUN_ID,
      trace_id: RUN_ID,
      name: "agent reply for [EMAIL]",
      inputs: {
        input: {
          api_key: "[REDACTED]",
          message: "Ligue para [PHONE]",
        },
      },
      extra: {
        metadata: expect.objectContaining({
          organization_id: expect.stringMatching(/^tenant_[a-f0-9]{16}$/),
          authorization: "[REDACTED]",
          customer_email: "[EMAIL]",
        }),
      },
    }));
    expect(updateRun).toHaveBeenCalledWith(RUN_ID, expect.objectContaining({
      trace_id: RUN_ID,
      dotted_order: `20260811T102000000001Z${RUN_ID}`,
      outputs: { output: { email: "[EMAIL]" } },
      error: "Bearer [REDACTED]",
      extra: { metadata: { latency_ms: 14 } },
    }));
    expect(JSON.stringify(createRun.mock.calls)).not.toContain(ORGANIZATION_ID);
    expect(JSON.stringify(createRun.mock.calls)).not.toContain("ana@example.test");
    expect(JSON.stringify(updateRun.mock.calls)).not.toContain("top-secret-token");
  });

  it("turns a client failure into a credential-safe structured warning", async () => {
    const warnings: Array<{ msg: string; fields?: Record<string, unknown> }> = [];
    const client: LangSmithClient = {
      createRun: vi.fn().mockRejectedValue(new Error(`request rejected for ${API_KEY}`)),
      updateRun: vi.fn(),
    };
    const tracer = new LangSmithAiTracer({
      logger: warningLogger(warnings),
      resolveConfig: vi.fn().mockResolvedValue(enabledConfig()),
      createClient: () => client,
    });

    const span = await tracer.startSpan({
      name: "agent_turn",
      runId: RUN_ID,
      organizationId: ORGANIZATION_ID,
    });
    await expect(span.end({ output: { status: "ok" } })).resolves.toBeUndefined();

    expect(warnings).toEqual([
      expect.objectContaining({
        msg: "LangSmith tracing failed",
        fields: {
          event: "langsmith_trace_failure",
          operation: "start",
          tenant_id: expect.stringMatching(/^tenant_[a-f0-9]{16}$/),
          trace_name: "agent_turn",
        },
      }),
    ]);
    expect(JSON.stringify(warnings)).not.toContain(API_KEY);
    expect(JSON.stringify(warnings)).not.toContain(ORGANIZATION_ID);
  });
});
