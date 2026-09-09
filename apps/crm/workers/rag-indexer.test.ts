/**
 * Regression suite for the RAG indexer worker (workers/rag-indexer.ts).
 *
 * This worker is the CRM's live knowledge-indexing path: it must route chunk
 * generation through the pluggable ingestion port (lib/ai/rag/ingestion/
 * resolve-adapter.ts) while the create -> chunks -> ready -> activate
 * lifecycle stays exactly as safe as it was before that seam existed.
 *
 * `resolveIngestionNodes` itself is already exhaustively covered by
 * lib/ai/rag/ingestion/resolve-adapter.test.ts (off/canary/on/shadow,
 * fallback-to-native, telemetry). This file does NOT re-test that resolver's
 * internal branching — it mocks the resolver and proves the *caller* wires it
 * correctly: the returned nodes (and only those nodes) are what gets written,
 * zero nodes never creates/activates a version, a resolver failure leaves the
 * previously active version untouched, provenance survives onto every
 * persisted chunk, and every query stays scoped to the trusted event's
 * organization_id.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EventRow } from "@/lib/event-log/dispatcher";
import type { IngestionNode } from "@/lib/ai/rag/ingestion/port";
import type { IngestionSelectionResult } from "@/lib/ai/rag/ingestion/resolve-adapter";

const orgA = "00000000-0000-4000-8000-000000000001";
const orgB = "00000000-0000-4000-8000-000000000002";
const agentId = "00000000-0000-4000-8000-000000000010";
const sourceId = "00000000-0000-4000-8000-000000000020";

// ---------------------------------------------------------------------------
// Mutable state captured by the fake admin (service-role) client
// ---------------------------------------------------------------------------

interface HarnessState {
  agent: Record<string, unknown> | null;
  /** Extra agents `resolveAgentById` can find by id (org's default agent is `agent` above, looked up via `resolveAgent`). */
  agentsById: Record<string, Record<string, unknown>>;
  sources: Record<string, unknown>[];
  faqItems: Record<string, unknown>[];
  tenantIntegration: Record<string, unknown> | null;
  maxVersionNumber: number;
  nextVersionId: string;
  insertedVersions: Record<string, unknown>[];
  versionUpdates: Record<string, unknown>[];
  sourceUpdates: Record<string, unknown>[];
  chunkUpserts: Record<string, unknown>[];
  activateCalls: Record<string, unknown>[];
  chunkUpsertShouldError: boolean;
  /**
   * Every `.eq(column, value)` call the code under test made, tagged with the
   * table it was made against (plus an `ai_chunks` entry synthesized from the
   * upsert row's `organization_id` field, since that table is written via
   * upsert rather than filtered via `.eq()`). This is what makes the
   * "org filters unchanged" assertions below actually load-bearing: deleting
   * a real `.eq("organization_id", ...)` call from workers/rag-indexer.ts or
   * lib/ai/rag/version.ts would leave a gap here that the test can catch,
   * instead of the fake client silently accepting any filter arguments.
   */
  filters: { table: string; column: string; value: unknown }[];
}

let state: HarnessState;

function resetState() {
  state = {
    agent: { id: agentId, organization_id: orgA, active_kb_version_id: "already-active-version", is_active: true, is_default: true },
    agentsById: {},
    sources: [{ id: sourceId, source_type: "faq", name: "FAQ Trocas" }],
    faqItems: [
      {
        knowledge_source_id: sourceId,
        question: "Qual o prazo de troca?",
        answer: "Trocas são aceitas em até 7 dias após o recebimento.",
      },
    ],
    tenantIntegration: {
      id: "integration-1",
      store_metadata: { store_id: "store-1" },
      oauth_access_token_encrypted: "cipher",
    },
    maxVersionNumber: 3,
    nextVersionId: "new-version-1",
    insertedVersions: [],
    versionUpdates: [],
    sourceUpdates: [],
    chunkUpserts: [],
    activateCalls: [],
    chunkUpsertShouldError: false,
    filters: [],
  };
}

/** Records a `.eq(column, value)` call against `table` and returns the same builder shape supplied. */
function trackEq(table: string, column: string, value: unknown) {
  state.filters.push({ table, column, value });
}

function makeAdmin() {
  return {
    from(table: string) {
      if (table === "ai_agents") {
        return {
          select: () => ({
            eq: (c1: string, v1: unknown) => {
              trackEq(table, c1, v1);
              return {
                // resolveAgent: .eq("organization_id").eq("is_active").order().order().limit().maybeSingle()
                // resolveAgentById: .eq("organization_id").eq("id", X).eq("is_active").maybeSingle()
                // Both start with the same organization_id eq; branch on the 2nd eq's column.
                eq: (c2: string, v2: unknown) => {
                  trackEq(table, c2, v2);
                  if (c2 === "id") {
                    const targetId = v2 as string;
                    return {
                      eq: (c3: string, v3: unknown) => {
                        trackEq(table, c3, v3);
                        return {
                          maybeSingle: async () => ({
                            data: state.agentsById[targetId] ?? null,
                            error: null,
                          }),
                        };
                      },
                    };
                  }
                  return {
                    order: () => ({
                      order: () => ({
                        limit: () => ({
                          maybeSingle: async () => ({ data: state.agent, error: null }),
                        }),
                      }),
                    }),
                  };
                },
              };
            },
          }),
        };
      }

      if (table === "tenant_integrations") {
        return {
          select: () => ({
            eq: (c1: string, v1: unknown) => {
              trackEq(table, c1, v1);
              return {
                eq: (c2: string, v2: unknown) => {
                  trackEq(table, c2, v2);
                  return {
                    eq: (c3: string, v3: unknown) => {
                      trackEq(table, c3, v3);
                      return {
                        maybeSingle: async () => ({ data: state.tenantIntegration, error: null }),
                      };
                    },
                  };
                },
              };
            },
          }),
        };
      }

      if (table === "ai_knowledge_sources") {
        return {
          select: () => ({
            eq: (c1: string, v1: unknown) => {
              trackEq(table, c1, v1);
              return {
                eq: (c2: string, v2: unknown) => {
                  trackEq(table, c2, v2);
                  return {
                    eq: async (c3: string, v3: unknown) => {
                      trackEq(table, c3, v3);
                      return { data: state.sources, error: null };
                    },
                  };
                },
              };
            },
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: (c1: string, v1: unknown) => {
              trackEq(table, c1, v1);
              return {
                eq: async (c2: string, v2: unknown) => {
                  trackEq(table, c2, v2);
                  state.sourceUpdates.push(patch);
                  return { error: null };
                },
              };
            },
          }),
        };
      }

      if (table === "ai_faq_items") {
        return {
          select: () => ({
            eq: (c1: string, v1: unknown) => {
              trackEq(table, c1, v1);
              return {
                in: () => ({
                  order: async () => ({ data: state.faqItems, error: null }),
                }),
              };
            },
          }),
        };
      }

      if (table === "ai_knowledge_versions") {
        return {
          select: (cols: string) => {
            if (cols.includes("version_number")) {
              return {
                eq: (c1: string, v1: unknown) => {
                  trackEq(table, c1, v1);
                  return {
                    eq: (c2: string, v2: unknown) => {
                      trackEq(table, c2, v2);
                      return {
                        order: () => ({
                          limit: () => ({
                            maybeSingle: async () => ({
                              data: { version_number: state.maxVersionNumber },
                              error: null,
                            }),
                          }),
                        }),
                      };
                    },
                  };
                },
              };
            }
            // activateVersion's tenant pre-check: select("id")...maybeSingle()
            return {
              eq: (c1: string, v1: unknown) => {
                trackEq(table, c1, v1);
                return {
                  eq: (c2: string, v2: unknown) => {
                    trackEq(table, c2, v2);
                    return {
                      eq: (c3: string, v3: unknown) => {
                        trackEq(table, c3, v3);
                        return {
                          maybeSingle: async () => ({ data: { id: state.nextVersionId }, error: null }),
                        };
                      },
                    };
                  },
                };
              },
            };
          },
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                state.insertedVersions.push(row);
                return {
                  data: { id: state.nextVersionId, version_number: state.maxVersionNumber + 1 },
                  error: null,
                };
              },
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: (c1: string, v1: unknown) => {
              trackEq(table, c1, v1);
              return {
                eq: async (c2: string, v2: unknown) => {
                  trackEq(table, c2, v2);
                  state.versionUpdates.push(patch);
                  return { error: null };
                },
              };
            },
          }),
        };
      }

      if (table === "ai_chunks") {
        return {
          upsert: (row: Record<string, unknown>) => {
            state.chunkUpserts.push(row);
            if ("organization_id" in row) {
              // ai_chunks has no .eq() filter — organization_id in the write
              // payload IS its entire tenant boundary under service role.
              trackEq(table, "organization_id", row["organization_id"]);
            }
            return Promise.resolve(
              state.chunkUpsertShouldError ? { error: { message: "boom" } } : { error: null },
            );
          },
        };
      }

      throw new Error(`rag-indexer.test: unexpected table "${table}"`);
    },
    rpc: async (name: string, params: Record<string, unknown>) => {
      if (name === "fn_decrypt_oauth") {
        return { data: "plaintext-access-token", error: null };
      }
      if (name === "activate_kb_version") {
        state.activateCalls.push(params);
        return { error: null };
      }
      throw new Error(`rag-indexer.test: unexpected rpc "${name}"`);
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => makeAdmin(),
}));

vi.mock("@/lib/ai/gateway", () => ({
  isEmbeddingProviderConfigured: () => true,
}));

vi.mock("@/lib/ai/embed", () => ({
  embedText: vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], promptTokens: 3, model: "test" })),
}));

vi.mock("@/lib/ai/rag/debounce", () => ({
  acquireDebounce: vi.fn(async () => true),
}));

vi.mock("@/lib/ai/rag/ingestion/resolve-adapter", () => ({
  resolveIngestionNodes: vi.fn(),
}));

vi.mock("@/lib/agent-engine/platform/features", () => ({
  resolveAiPlatformFeature: vi.fn(async () => ({ mode: "off", config: {}, killed: false })),
}));

vi.mock("@/lib/nuvemshop/api-client", () => ({
  NuvemshopApiClient: class {
    async get() {
      return {
        id: "product-1",
        name: "Camiseta Azul",
        description: "Camiseta 100% algodão",
        price: "99.90",
        sku: "CAM-AZ",
      };
    }
  },
}));

import { processRagIndexer } from "@/workers/rag-indexer";
import { embedText } from "@/lib/ai/embed";
import { resolveIngestionNodes } from "@/lib/ai/rag/ingestion/resolve-adapter";
import { resolveAiPlatformFeature } from "@/lib/agent-engine/platform/features";

const resolveIngestionNodesMock = vi.mocked(resolveIngestionNodes);
const resolveAiPlatformFeatureMock = vi.mocked(resolveAiPlatformFeature);

function node(text: string, position: number, extra: Record<string, string | number | boolean | null> = {}): IngestionNode {
  return {
    text,
    position,
    metadata: {
      organizationId: orgA,
      sourceId,
      sourceVersion: "v",
      title: "t",
      contentHash: `hash-${position}-${text}`,
      ...extra,
    },
  };
}

function selection(mode: IngestionSelectionResult["mode"], nodes: IngestionNode[], rest: Partial<IngestionSelectionResult> = {}): IngestionSelectionResult {
  return { mode, nodes, ...rest };
}

/** Asserts `table` was filtered/written by `("organization_id", orgA)` at least once. */
function expectOrgFiltered(table: string) {
  expect(state.filters).toContainEqual({ table, column: "organization_id", value: orgA });
}

function faqEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    organization_id: orgA,
    event_type: "knowledge_source.updated",
    entity_kind: "knowledge_source",
    entity_id: sourceId,
    payload: {},
    metadata: {},
    consumed_by: [],
    attempts: 0,
    ...overrides,
  };
}

function productEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "00000000-0000-4000-8000-000000000098",
    organization_id: orgA,
    event_type: "nuvemshop.product_synced",
    entity_kind: "product",
    entity_id: "product-1",
    payload: { product_id: "product-1", action: "updated" },
    metadata: {},
    consumed_by: [],
    attempts: 0,
    ...overrides,
  };
}

beforeEach(() => {
  resetState();
  resolveIngestionNodesMock.mockReset();
  resolveAiPlatformFeatureMock.mockClear();
  resolveAiPlatformFeatureMock.mockResolvedValue({ mode: "off", config: {}, killed: false });
  vi.mocked(embedText).mockClear();
});

describe("rag-indexer — knowledge_source.updated (FAQ path)", () => {
  it("feature off: uses the native adapter's output and activates the new version", async () => {
    resolveIngestionNodesMock.mockResolvedValueOnce(selection("native", [node("chunk-a", 0)]));

    const result = await processRagIndexer(faqEvent());

    expect(result.status).toBe("ok");
    expect(state.insertedVersions).toHaveLength(1);
    expect(state.chunkUpserts).toHaveLength(1);
    expect(state.chunkUpserts[0]).toMatchObject({
      content: "chunk-a",
      organization_id: orgA,
      metadata: expect.objectContaining({ ingestion_mode: "native" }),
    });
    expect(state.activateCalls).toHaveLength(1);
    expect(state.versionUpdates).toContainEqual(expect.objectContaining({ status: "ready" }));
  });

  it("shadow mode: stores only the resolver's returned (native) nodes, never llamaindex output", async () => {
    resolveIngestionNodesMock.mockResolvedValueOnce(
      selection("shadow", [node("native-answer", 0)], {
        shadow: {
          nativeNodeCount: 1,
          llamaIndexNodeCount: 2,
          nodeCountDelta: 1,
          textMatches: false,
          degraded: false,
        },
      }),
    );

    const result = await processRagIndexer(faqEvent());

    expect(result.status).toBe("ok");
    expect(state.chunkUpserts).toHaveLength(1);
    // The only content ever written is what resolveIngestionNodes.nodes carried —
    // the shadow comparison object is never read for content by the indexer.
    expect(state.chunkUpserts[0]?.["content"]).toBe("native-answer");
    // `ingestion_mode` describes what's actually persisted in this row's
    // content — always "native" in shadow mode, since shadow only ever
    // writes the native adapter's output. `resolver_mode` separately
    // records that the resolver ran under "shadow" for this document.
    expect(state.chunkUpserts[0]).toMatchObject({
      metadata: expect.objectContaining({ ingestion_mode: "native", resolver_mode: "shadow" }),
    });
    expect(state.activateCalls).toHaveLength(1);
  });

  it("resolver failure (both adapters unavailable) leaves the previously active version untouched", async () => {
    resolveIngestionNodesMock.mockRejectedValueOnce(new Error("native_and_llamaindex_both_failed"));

    const result = await processRagIndexer(faqEvent());

    expect(result.status).toBe("error");
    // No version was ever created — chunk resolution happens before
    // createKnowledgeVersion, exactly like the pre-refactor chunkText() call.
    expect(state.insertedVersions).toHaveLength(0);
    expect(state.versionUpdates).toHaveLength(0);
    // The atomic activate_kb_version swap never ran, so whatever version was
    // active before this event stays active.
    expect(state.activateCalls).toHaveLength(0);
    expect(state.chunkUpserts).toHaveLength(0);
  });

  it("zero nodes from the resolver never creates or activates a version (pre-version-creation path)", async () => {
    resolveIngestionNodesMock.mockResolvedValueOnce(selection("native", []));

    const result = await processRagIndexer(faqEvent());

    expect(result).toMatchObject({ status: "skipped", detail: "no_chunks_generated" });
    expect(state.insertedVersions).toHaveLength(0);
    expect(state.activateCalls).toHaveLength(0);
  });

  it("all chunk writes failing after a version was created marks it failed and never activates it", async () => {
    resolveIngestionNodesMock.mockResolvedValueOnce(selection("native", [node("chunk-a", 0)]));
    state.chunkUpsertShouldError = true;

    const result = await processRagIndexer(faqEvent());

    expect(result.status).toBe("error");
    // A version WAS created (chunking succeeded), but since every write to
    // ai_chunks failed, it must be marked failed, not activated — the agent
    // keeps answering from the previous base instead of an empty one.
    expect(state.insertedVersions).toHaveLength(1);
    expect(state.versionUpdates).toContainEqual(expect.objectContaining({ status: "failed" }));
    expect(state.activateCalls).toHaveLength(0);
  });

  it("stamps the resolved adapter mode onto every persisted chunk's metadata (provenance)", async () => {
    resolveIngestionNodesMock.mockResolvedValueOnce(selection("llamaindex", [node("chunk-a", 0), node("chunk-b", 1)]));

    await processRagIndexer(faqEvent());

    expect(state.chunkUpserts).toHaveLength(2);
    for (const row of state.chunkUpserts) {
      const metadata = row["metadata"] as Record<string, unknown>;
      expect(metadata["ingestion_mode"]).toBe("llamaindex");
      expect(metadata["resolver_mode"]).toBe("llamaindex");
    }
  });

  it("N>1 FAQ items: resolves the feature/adapter ONCE for the whole event, not once per item, and indexes every item", async () => {
    state.faqItems = [
      { knowledge_source_id: sourceId, question: "Qual o prazo de troca?", answer: "Até 7 dias." },
      { knowledge_source_id: sourceId, question: "Como rastreio meu pedido?", answer: "Pelo link enviado por e-mail." },
    ];
    resolveIngestionNodesMock
      .mockResolvedValueOnce(selection("native", [node("chunk-item-1", 0)]))
      .mockResolvedValueOnce(selection("native", [node("chunk-item-2", 0)]));

    const result = await processRagIndexer(faqEvent());

    expect(result.status).toBe("ok");
    // Feature/adapter resolution happens ONCE per EVENT, not once per item —
    // resolveAiPlatformFeature costs 2 Supabase round trips per call, so N
    // items must cost 1 lookup, not N (previously 2N extra DB round trips).
    expect(resolveAiPlatformFeatureMock).toHaveBeenCalledTimes(1);
    expect(resolveAiPlatformFeatureMock).toHaveBeenCalledWith({
      organizationId: orgA,
      feature: "llamaindex",
    });
    // Per-item chunking (resolveIngestionNodes) still runs once per item —
    // only the underlying feature-flag lookup is cached/shared.
    expect(resolveIngestionNodesMock).toHaveBeenCalledTimes(2);
    // Both per-item calls receive the SAME cached resolveFeature closure —
    // if the hoist forgot to thread it through, each item would get its own
    // fresh closure (or none), silently reintroducing a per-item lookup.
    const firstResolveFeature = resolveIngestionNodesMock.mock.calls[0]?.[0]?.resolveFeature;
    const secondResolveFeature = resolveIngestionNodesMock.mock.calls[1]?.[0]?.resolveFeature;
    expect(firstResolveFeature).toBeInstanceOf(Function);
    expect(secondResolveFeature).toBe(firstResolveFeature);
    // Both items were actually indexed — hoisting the resolution doesn't
    // drop or skip any item.
    expect(state.chunkUpserts).toHaveLength(2);
    expect(state.chunkUpserts.map((c) => c["content"])).toEqual(["chunk-item-1", "chunk-item-2"]);
    expect(state.activateCalls).toHaveLength(1);
  });

  it("uses the adapter-provided content hash instead of recomputing it, when present", async () => {
    resolveIngestionNodesMock.mockResolvedValueOnce(
      selection("native", [node("chunk-a", 0, { contentHash: "adapter-supplied-hash" })]),
    );

    await processRagIndexer(faqEvent());

    expect(state.chunkUpserts[0]?.["content_hash"]).toBe("adapter-supplied-hash");
  });

  it("org filters unchanged: resolves and persists everything under the trusted event organization_id, never a different one", async () => {
    resolveIngestionNodesMock.mockResolvedValueOnce(selection("native", [node("chunk-a", 0)]));

    await processRagIndexer(faqEvent({ organization_id: orgA }));

    expect(resolveIngestionNodesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: orgA,
        document: expect.objectContaining({
          metadata: expect.objectContaining({ organizationId: orgA }),
        }),
      }),
    );
    expect(resolveIngestionNodesMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: orgB }),
    );
    expect(state.chunkUpserts[0]).toMatchObject({ organization_id: orgA });
    // last_index_* patch from the per-source status update — real fields,
    // not an assertion that matches literally anything.
    expect(state.sourceUpdates[0]).toMatchObject({ last_index_status: "success", chunks_count: 1 });

    // Every table this handler touches was actually filtered/written under
    // orgA, and no filter anywhere carried orgB or another value — this is
    // what makes the property load-bearing: a future change that drops
    // `.eq("organization_id", ...)` from ai_agents/ai_knowledge_sources/
    // ai_faq_items/ai_knowledge_versions (workers/rag-indexer.ts or
    // lib/ai/rag/version.ts) would fail one of these assertions.
    for (const table of ["ai_agents", "ai_knowledge_sources", "ai_faq_items", "ai_knowledge_versions", "ai_chunks"]) {
      expectOrgFiltered(table);
    }
    const orgFilters = state.filters.filter((f) => f.column === "organization_id");
    expect(orgFilters.length).toBeGreaterThanOrEqual(5);
    for (const f of orgFilters) {
      expect(f.value).toBe(orgA);
    }
  });

  it("routes to the event's own agent_id, not the org's default agent (multi-agent org)", async () => {
    // `state.agent` (id = `agentId`) is the org's default agent — the fixture
    // that resolveAgent()'s org-default fallback would return. This proves
    // the event instead targets the NON-default agent named in its payload.
    const otherAgentId = "00000000-0000-4000-8000-000000000040";
    state.agentsById[otherAgentId] = { id: otherAgentId };
    resolveIngestionNodesMock.mockResolvedValueOnce(selection("native", [node("chunk-a", 0)]));

    await processRagIndexer(faqEvent({ payload: { agent_id: otherAgentId } }));

    expect(state.filters).toContainEqual({
      table: "ai_knowledge_sources",
      column: "agent_id",
      value: otherAgentId,
    });
    expect(state.filters).not.toContainEqual({
      table: "ai_knowledge_sources",
      column: "agent_id",
      value: agentId,
    });
  });

  it("falls back to the org's default agent when the event has no payload.agent_id", async () => {
    resolveIngestionNodesMock.mockResolvedValueOnce(selection("native", [node("chunk-a", 0)]));

    await processRagIndexer(faqEvent());

    expect(state.filters).toContainEqual({
      table: "ai_knowledge_sources",
      column: "agent_id",
      value: agentId,
    });
  });

  it("never marks a `conversations` source failed: it has no ai_faq_items by design (fed by the dedicated kb-conversations-batch cron instead)", async () => {
    const conversationsSourceId = "00000000-0000-4000-8000-000000000030";
    state.sources.push({
      id: conversationsSourceId,
      source_type: "conversations",
      name: "",
    });
    resolveIngestionNodesMock.mockResolvedValueOnce(selection("native", [node("chunk-a", 0)]));

    await processRagIndexer(faqEvent());

    // Only the FAQ source gets a status write; the conversations source is
    // skipped entirely, never touched by this generic FAQ-based reindex.
    expect(state.sourceUpdates).toHaveLength(1);
    expect(state.sourceUpdates[0]).toMatchObject({ last_index_status: "success" });
  });
});

describe("rag-indexer — nuvemshop.product_synced (product path)", () => {
  it("feature off: uses the native adapter's output, scoped to org and stamped with provenance", async () => {
    resolveIngestionNodesMock.mockResolvedValueOnce(selection("native", [node("Produto: Camiseta Azul", 0)]));

    const result = await processRagIndexer(productEvent());

    expect(result.status).toBe("ok");
    expect(resolveIngestionNodesMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: orgA }),
    );
    expect(state.chunkUpserts).toHaveLength(1);
    expect(state.chunkUpserts[0]).toMatchObject({
      organization_id: orgA,
      metadata: expect.objectContaining({
        ingestion_mode: "native",
        resolver_mode: "native",
        product_id: "product-1",
      }),
    });
    expect(state.activateCalls).toHaveLength(1);
    for (const table of ["ai_agents", "tenant_integrations", "ai_knowledge_versions", "ai_chunks"]) {
      expectOrgFiltered(table);
    }
  });

  it("zero nodes from the resolver skips before any version is created", async () => {
    resolveIngestionNodesMock.mockResolvedValueOnce(selection("native", []));

    const result = await processRagIndexer(productEvent());

    expect(result).toMatchObject({ status: "skipped", detail: "no_chunks_generated" });
    expect(state.insertedVersions).toHaveLength(0);
    expect(state.activateCalls).toHaveLength(0);
  });

  it("resolver failure leaves the previously active version untouched", async () => {
    resolveIngestionNodesMock.mockRejectedValueOnce(new Error("resolver_exploded"));

    const result = await processRagIndexer(productEvent());

    expect(result.status).toBe("error");
    expect(state.insertedVersions).toHaveLength(0);
    expect(state.activateCalls).toHaveLength(0);
  });
});
