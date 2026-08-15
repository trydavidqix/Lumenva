import { describe, expect, it, vi } from "vitest";

import { retrieveOptionalContextBlocks } from "./inbound-turn";
import type { ContextProvider, ContextRetrievalResult } from "../context/provider";
import type { Logger } from "../obs/logger";

function silentLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function disabledResult(provider: string): ContextRetrievalResult {
  return { provider, items: [], shadowItems: [], degraded: false, influencePrompt: false, bucket: "disabled" };
}

const buildRequest = (nowMs: number) => ({
  organizationId: "00000000-0000-4000-8000-000000000001",
  contactId: "00000000-0000-4000-8000-000000000002",
  conversationId: "00000000-0000-4000-8000-000000000003",
  agentId: "00000000-0000-4000-8000-000000000004",
  query: "contexto",
  now: new Date(nowMs).toISOString(),
});

/**
 * Resolves only once BOTH gated providers below have been invoked. A
 * serialized implementation (e.g. `await mem0Retrieve(); await
 * graphitiRetrieve();`) never calls the second provider until the first
 * provider's own promise has already resolved — but the first provider's
 * promise here is gated on the SECOND having already started, so a
 * serialized implementation deadlocks on its own first `await` and the test
 * times out instead of silently passing.
 */
function bothInFlightGate() {
  let startedCount = 0;
  let releaseBoth: () => void;
  const bothInFlight = new Promise<void>((resolve) => {
    releaseBoth = resolve;
  });
  const markStarted = () => {
    startedCount += 1;
    if (startedCount === 2) releaseBoth();
  };
  return { bothInFlight, markStarted, startedCount: () => startedCount };
}

describe("retrieveOptionalContextBlocks", () => {
  it(
    "invokes Mem0 and Graphiti CONCURRENTLY — a serialized implementation would deadlock this test",
    async () => {
      const gate = bothInFlightGate();
      const callOrder: string[] = [];

      const mem0: ContextProvider = {
        name: "mem0",
        retrieve: vi.fn(async () => {
          callOrder.push("mem0-started");
          gate.markStarted();
          await gate.bothInFlight;
          return disabledResult("mem0");
        }),
      };
      const graphiti: ContextProvider = {
        name: "graphiti",
        retrieve: vi.fn(async () => {
          callOrder.push("graphiti-started");
          gate.markStarted();
          await gate.bothInFlight;
          return disabledResult("graphiti");
        }),
      };

      const result = await retrieveOptionalContextBlocks({
        semanticContextProvider: mem0,
        graphContextProvider: graphiti,
        buildRequest,
        recordMetric: undefined,
        log: silentLogger(),
      });

      expect(mem0.retrieve).toHaveBeenCalledTimes(1);
      expect(graphiti.retrieve).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual(["mem0-started", "graphiti-started"]);
      expect(gate.startedCount()).toBe(2);
      expect(result).toEqual({ semanticContextBlock: "", graphContextBlock: "" });
    },
    2000,
  );

  it("still returns both blocks when only one provider is configured", async () => {
    const mem0: ContextProvider = { name: "mem0", retrieve: vi.fn().mockResolvedValue(disabledResult("mem0")) };

    const result = await retrieveOptionalContextBlocks({
      semanticContextProvider: mem0,
      graphContextProvider: undefined,
      buildRequest,
      recordMetric: undefined,
      log: silentLogger(),
    });

    expect(mem0.retrieve).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ semanticContextBlock: "", graphContextBlock: "" });
  });

  it("a failing Graphiti provider never blocks or empties the Mem0 block", async () => {
    const mem0: ContextProvider = {
      name: "mem0",
      retrieve: vi.fn().mockResolvedValue({
        provider: "mem0",
        items: [{
          id: "memory-1",
          provider: "mem0",
          authorityDomain: "customer_preference",
          authorityLevel: 40,
          confidence: 0.9,
          occurredAt: null,
          expiresAt: null,
          risk: "low",
          actionable: true,
          sourceId: "message-1",
          text: "Prefere WhatsApp.",
        }],
        shadowItems: [],
        degraded: false,
        influencePrompt: true,
        bucket: "candidate",
      }),
    };
    const graphiti: ContextProvider = { name: "graphiti", retrieve: vi.fn().mockRejectedValue(new Error("graph unavailable")) };

    const result = await retrieveOptionalContextBlocks({
      semanticContextProvider: mem0,
      graphContextProvider: graphiti,
      buildRequest,
      recordMetric: undefined,
      log: silentLogger(),
    });

    expect(result.graphContextBlock).toBe("");
    expect(result.semanticContextBlock).toContain("Prefere WhatsApp.");
  });
});
