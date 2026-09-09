import { describe, expect, it, vi } from "vitest";

import type { AiTraceSpan, AiTracer } from "../../obs/ai-tracing";
import type { Logger } from "../../obs/logger";
import { LangSmithAiTracer, type LangSmithClient } from "../../obs/langsmith-adapter";
import { createFakeRegistry } from "./providers";
import { runModelCall } from "./run-model-call";

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000002";
const JOB_ID = "00000000-0000-4000-8000-000000000001";
const API_KEY = "unit-test-provider-key-that-must-not-be-traced";

function modelCallPool() {
  return {
    query: vi.fn(async (query: string) => {
      if (query.includes("select settings->'llm'")) {
        return {
          rows: [{
            llm: {
              provider: "anthropic",
              default_model: "claude-sonnet-4-6",
              monthly_budget_cents: null,
            },
          }],
        };
      }
      if (query.includes("from ai_provider_credentials")) return { rows: [] };
      if (query.includes("insert into llm_calls")) return { rows: [{ id: "call-1" }] };
      throw new Error(`unexpected query: ${query}`);
    }),
  } as never;
}

function failingTraceLogger(warnings: Array<{ msg: string; fields?: Record<string, unknown> }>): Logger {
  return {
    info: () => undefined,
    warn: (msg, fields) => warnings.push({ msg, fields }),
    error: () => undefined,
  };
}

describe("runModelCall tracing", () => {
  it("creates one metadata-first span after model resolution and records model metrics", async () => {
    const starts: Parameters<AiTracer["startSpan"]>[0][] = [];
    const ends: Parameters<AiTraceSpan["end"]>[0][] = [];
    const tracer: AiTracer = {
      startSpan: vi.fn(async (input) => {
        starts.push(input);
        return {
          end: vi.fn(async (input) => {
            ends.push(input);
          }),
        };
      }),
    };

    await runModelCall(
      modelCallPool(),
      { anthropicApiKey: API_KEY },
      {
        tenantId: ORGANIZATION_ID,
        jobId: JOB_ID,
        purpose: "classifier",
        system: "Never export this system prompt.",
        messages: [{ role: "user", content: "Customer private prompt: ana@example.test" }],
      },
      { registry: createFakeRegistry(), tracer } as never,
    );

    expect(starts).toEqual([
      {
        name: "llm_model_call",
        runId: expect.stringMatching(/^[a-f0-9-]{36}$/),
        traceId: JOB_ID,
        organizationId: ORGANIZATION_ID,
        metadata: {
          purpose: "classifier",
          organization_id: expect.stringMatching(/^tenant_[a-f0-9]{16}$/),
          job_id: JOB_ID,
          provider: "anthropic",
          model: "claude-sonnet-4-6",
        },
      },
    ]);
    expect(ends).toEqual([
      {
        metrics: {
          latency_ms: expect.any(Number),
          input_tokens: 1,
          output_tokens: 1,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          cost_cents: 0.0018,
        },
      },
    ]);
    expect(JSON.stringify(starts)).not.toContain("Never export this system prompt.");
    expect(JSON.stringify(starts)).not.toContain("Customer private prompt");
    expect(JSON.stringify(starts)).not.toContain(API_KEY);
  });

  it("keeps model execution available when tracing start or end fails", async () => {
    const baseRegistry = createFakeRegistry();
    const anthropic = vi.fn(baseRegistry.anthropic);
    const registry = { anthropic };
    const endFailure: AiTraceSpan = {
      end: vi.fn().mockRejectedValue(new Error("trace export unavailable")),
    };
    const tracer: AiTracer = {
      startSpan: vi
        .fn()
        .mockRejectedValueOnce(new Error("trace setup unavailable"))
        .mockResolvedValueOnce(endFailure),
    };

    const first = await runModelCall(
      modelCallPool(),
      { anthropicApiKey: API_KEY },
      { tenantId: ORGANIZATION_ID, messages: [{ role: "user", content: "first" }] },
      { registry, tracer } as never,
    );
    const second = await runModelCall(
      modelCallPool(),
      { anthropicApiKey: API_KEY },
      { tenantId: ORGANIZATION_ID, messages: [{ role: "user", content: "second" }] },
      { registry, tracer } as never,
    );

    expect(first.result.text).toBe("ok");
    expect(second.result.text).toBe("ok");
    expect(anthropic).toHaveBeenCalledTimes(2);
    expect(endFailure.end).toHaveBeenCalledOnce();
  });

  it.each([
    ["timeout", new Error("synthetic trace timeout")],
    ["401", new Error("synthetic trace HTTP 401")],
    ["429", new Error("synthetic trace HTTP 429")],
  ])("keeps the model call available when LangSmith returns %s", async (_scenario, traceFailure) => {
    const warnings: Array<{ msg: string; fields?: Record<string, unknown> }> = [];
    const client: LangSmithClient = {
      createRun: vi.fn().mockRejectedValue(traceFailure),
      updateRun: vi.fn(),
    };
    const tracer = new LangSmithAiTracer({
      logger: failingTraceLogger(warnings),
      resolveConfig: vi.fn().mockResolvedValue({
        enabled: true,
        apiKey: "synthetic-test-key",
        project: "synthetic-phase-1-gate",
      }),
      createClient: () => client,
    });

    const outcome = await runModelCall(
      modelCallPool(),
      { anthropicApiKey: API_KEY },
      { tenantId: ORGANIZATION_ID, messages: [{ role: "user", content: "synthetic safe prompt" }] },
      { registry: createFakeRegistry(), tracer } as never,
    );

    expect(outcome.result.text).toBe("ok");
    expect(warnings).toEqual([
      {
        msg: "LangSmith tracing failed",
        fields: {
          event: "langsmith_trace_failure",
          operation: "start",
          tenant_id: expect.stringMatching(/^tenant_[a-f0-9]{16}$/),
          trace_name: "llm_model_call",
        },
      },
    ]);
    expect(JSON.stringify(warnings)).not.toContain("synthetic-test-key");
  });
});
