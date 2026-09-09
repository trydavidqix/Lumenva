import { describe, expect, it, vi } from "vitest";

import type { IngestionDocument, IngestionNode, KnowledgeIngestionPort } from "./port";
import { resolveIngestionNodes } from "./resolve-adapter";

const organizationId = "00000000-0000-4000-8000-000000000001";
const document: IngestionDocument = {
  text: "Trocas são aceitas em até 7 dias após o recebimento.",
  metadata: {
    organizationId,
    sourceId: "faq-trocas",
    sourceVersion: "1",
    title: "FAQ — Trocas",
  },
};

function fakeAdapter(nodes: IngestionNode[]): KnowledgeIngestionPort {
  return { normalize: vi.fn().mockResolvedValue(nodes) };
}

function nodeAt(text: string, position = 0): IngestionNode {
  return { text, position, metadata: { organizationId } };
}

describe("resolveIngestionNodes", () => {
  it("uses the native adapter when the feature is off", async () => {
    const nativeAdapter = fakeAdapter([nodeAt("native-chunk")]);
    const llamaIndexAdapter = fakeAdapter([nodeAt("llamaindex-chunk")]);

    const result = await resolveIngestionNodes({
      organizationId,
      document,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "off", config: {}, killed: false }),
      nativeAdapter,
      llamaIndexAdapter,
    });

    expect(result).toEqual({ mode: "native", nodes: [nodeAt("native-chunk")] });
    expect(nativeAdapter.normalize).toHaveBeenCalledWith(document);
    expect(llamaIndexAdapter.normalize).not.toHaveBeenCalled();
  });

  it("uses the native adapter when the feature is killed, even if a database row says on", async () => {
    const nativeAdapter = fakeAdapter([nodeAt("native-chunk")]);
    const llamaIndexAdapter = fakeAdapter([nodeAt("llamaindex-chunk")]);

    // resolveAiPlatformFeature already collapses a killed feature to mode "off"
    // before this resolver ever sees it — asserted here as the contract this
    // resolver relies on rather than re-implementing the kill-switch check.
    const result = await resolveIngestionNodes({
      organizationId,
      document,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "off", config: {}, killed: true }),
      nativeAdapter,
      llamaIndexAdapter,
    });

    expect(result.mode).toBe("native");
    expect(llamaIndexAdapter.normalize).not.toHaveBeenCalled();
  });

  it("uses the LlamaIndex adapter's output when the feature is canary", async () => {
    const nativeAdapter = fakeAdapter([nodeAt("native-chunk")]);
    const llamaIndexAdapter = fakeAdapter([nodeAt("llamaindex-chunk")]);

    const result = await resolveIngestionNodes({
      organizationId,
      document,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "canary", config: {}, killed: false }),
      nativeAdapter,
      llamaIndexAdapter,
    });

    expect(result).toEqual({ mode: "llamaindex", nodes: [nodeAt("llamaindex-chunk")] });
    expect(nativeAdapter.normalize).not.toHaveBeenCalled();
  });

  it("uses the LlamaIndex adapter's output when the feature is on", async () => {
    const nativeAdapter = fakeAdapter([nodeAt("native-chunk")]);
    const llamaIndexAdapter = fakeAdapter([nodeAt("llamaindex-chunk")]);

    const result = await resolveIngestionNodes({
      organizationId,
      document,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "on", config: {}, killed: false }),
      nativeAdapter,
      llamaIndexAdapter,
    });

    expect(result).toEqual({ mode: "llamaindex", nodes: [nodeAt("llamaindex-chunk")] });
    expect(nativeAdapter.normalize).not.toHaveBeenCalled();
  });

  it("fails open to the native adapter's output when the LlamaIndex adapter throws in canary mode", async () => {
    const nativeAdapter = fakeAdapter([nodeAt("native-chunk")]);
    const llamaIndexAdapter: KnowledgeIngestionPort = {
      normalize: vi.fn().mockRejectedValue(new Error("llamaindex boom")),
    };
    const recordAdapterFailure = vi.fn();

    const result = await resolveIngestionNodes({
      organizationId,
      document,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "canary", config: {}, killed: false }),
      nativeAdapter,
      llamaIndexAdapter,
      recordAdapterFailure,
    });

    expect(result).toEqual({
      mode: "native",
      nodes: [nodeAt("native-chunk")],
      fallback: { mode: "canary", reason: "llamaindex_adapter_unavailable" },
    });
    expect(nativeAdapter.normalize).toHaveBeenCalledWith(document);
    expect(recordAdapterFailure).toHaveBeenCalledWith({ mode: "canary", reason: "llamaindex_adapter_unavailable" });
  });

  it("fails open to the native adapter's output when the LlamaIndex adapter throws in on mode", async () => {
    const nativeAdapter = fakeAdapter([nodeAt("native-chunk")]);
    const llamaIndexAdapter: KnowledgeIngestionPort = {
      normalize: vi.fn().mockRejectedValue(new Error("llamaindex boom")),
    };

    const result = await resolveIngestionNodes({
      organizationId,
      document,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "on", config: {}, killed: false }),
      nativeAdapter,
      llamaIndexAdapter,
    });

    expect(result).toEqual({
      mode: "native",
      nodes: [nodeAt("native-chunk")],
      fallback: { mode: "on", reason: "llamaindex_adapter_unavailable" },
    });
  });

  it("never lets a failing adapter-failure recorder block the canary/on native fallback", async () => {
    const nativeAdapter = fakeAdapter([nodeAt("native-chunk")]);
    const llamaIndexAdapter: KnowledgeIngestionPort = {
      normalize: vi.fn().mockRejectedValue(new Error("llamaindex boom")),
    };

    const result = await resolveIngestionNodes({
      organizationId,
      document,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "on", config: {}, killed: false }),
      nativeAdapter,
      llamaIndexAdapter,
      recordAdapterFailure: vi.fn().mockRejectedValue(new Error("telemetry sink down")),
    });

    expect(result.mode).toBe("native");
    expect(result.nodes).toEqual([nodeAt("native-chunk")]);
  });

  it("runs both adapters in shadow mode but only ever returns the native adapter's nodes", async () => {
    const nativeAdapter = fakeAdapter([nodeAt("native-chunk", 0)]);
    const llamaIndexAdapter = fakeAdapter([nodeAt("llamaindex-chunk-a", 0), nodeAt("llamaindex-chunk-b", 1)]);
    const recordShadowComparison = vi.fn();

    const result = await resolveIngestionNodes({
      organizationId,
      document,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "shadow", config: {}, killed: false }),
      nativeAdapter,
      llamaIndexAdapter,
      recordShadowComparison,
    });

    expect(result.mode).toBe("shadow");
    expect(result.nodes).toEqual([nodeAt("native-chunk", 0)]);
    expect(nativeAdapter.normalize).toHaveBeenCalledWith(document);
    expect(llamaIndexAdapter.normalize).toHaveBeenCalledWith(document);
    expect(result.shadow).toEqual({
      nativeNodeCount: 1,
      llamaIndexNodeCount: 2,
      nodeCountDelta: 1,
      textMatches: false,
      degraded: false,
    });
    expect(recordShadowComparison).toHaveBeenCalledWith(result.shadow);
  });

  it("reports textMatches true in shadow mode when both adapters produce identical chunk text", async () => {
    const nativeAdapter = fakeAdapter([nodeAt("same-chunk", 0)]);
    const llamaIndexAdapter = fakeAdapter([nodeAt("same-chunk", 0)]);

    const result = await resolveIngestionNodes({
      organizationId,
      document,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "shadow", config: {}, killed: false }),
      nativeAdapter,
      llamaIndexAdapter,
    });

    expect(result.shadow).toMatchObject({ textMatches: true, nodeCountDelta: 0, degraded: false });
  });

  it("marks the shadow comparison degraded and keeps native output when the LlamaIndex adapter throws", async () => {
    const nativeAdapter = fakeAdapter([nodeAt("native-chunk")]);
    const llamaIndexAdapter: KnowledgeIngestionPort = {
      normalize: vi.fn().mockRejectedValue(new Error("llamaindex boom")),
    };

    const result = await resolveIngestionNodes({
      organizationId,
      document,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "shadow", config: {}, killed: false }),
      nativeAdapter,
      llamaIndexAdapter,
    });

    expect(result.mode).toBe("shadow");
    expect(result.nodes).toEqual([nodeAt("native-chunk")]);
    expect(result.shadow).toMatchObject({ degraded: true, reason: "llamaindex_adapter_unavailable" });
  });

  it("never lets a failing shadow-comparison recorder affect the returned nodes", async () => {
    const nativeAdapter = fakeAdapter([nodeAt("native-chunk")]);
    const llamaIndexAdapter = fakeAdapter([nodeAt("llamaindex-chunk")]);

    const result = await resolveIngestionNodes({
      organizationId,
      document,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "shadow", config: {}, killed: false }),
      nativeAdapter,
      llamaIndexAdapter,
      recordShadowComparison: vi.fn().mockRejectedValue(new Error("telemetry sink down")),
    });

    expect(result.mode).toBe("shadow");
    expect(result.nodes).toEqual([nodeAt("native-chunk")]);
  });

  it("passes organizationId and the document through to resolveFeature", async () => {
    const resolveFeature = vi.fn().mockResolvedValue({ mode: "off", config: {}, killed: false });

    await resolveIngestionNodes({
      organizationId,
      document,
      resolveFeature,
      nativeAdapter: fakeAdapter([]),
    });

    expect(resolveFeature).toHaveBeenCalledWith({ organizationId, feature: "llamaindex" });
  });
});
