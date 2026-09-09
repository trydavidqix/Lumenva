/**
 * RAG indexer worker — consumes domain events and indexes content into
 * `ai_chunks` + `ai_knowledge_versions` for semantic retrieval.
 *
 * Events handled:
 *   - nuvemshop.product_synced  → fetches product, embeds chunks, activates version
 *   - knowledge_source.updated  → stub (full reindex deferred to S-06.05..07)
 *
 * Service-role caveat (CLAUDE.md §multi-tenancy): every query filters
 * `organization_id` from the trusted event row, never from user input.
 */

import { isEmbeddingProviderConfigured } from "@/lib/ai/gateway";
import { embedText } from "@/lib/ai/embed";
import { acquireDebounce } from "@/lib/ai/rag/debounce";
import { computeContentHash } from "@/lib/ai/rag/chunker";
import { estimateTokens } from "@/lib/ai/runtime/history";
import { formatProductForRag, type NuvemshopProduct } from "@/lib/ai/rag/format-product";
import {
  createKnowledgeVersion,
  markVersionReady,
  markVersionFailed,
  activateVersion,
} from "@/lib/ai/rag/version";
import {
  resolveIngestionNodes,
  type IngestionAdapterFailure,
  type IngestionAdapterMode,
  type IngestionSelectionResult,
  type ShadowIngestionComparison,
} from "@/lib/ai/rag/ingestion/resolve-adapter";
import type { IngestionNode } from "@/lib/ai/rag/ingestion/port";
import { resolveAiPlatformFeature, type ResolvedAiPlatformFeature } from "@/lib/agent-engine/platform/features";
import type { EventRow, HandlerResult } from "@/lib/event-log/dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";
import { NuvemshopApiClient } from "@/lib/nuvemshop/api-client";

const DEBOUNCE_TTL_SEC = 30;
const LAG_WARN_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SkipResult = { type: "skip"; reason: string };
type ErrorResult = { type: "error"; detail: string };
type OkResult = { type: "ok"; versionId: string; chunkCount: number };
type ProcessResult = SkipResult | ErrorResult | OkResult;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function skip(reason: string): SkipResult {
  return { type: "skip", reason };
}

/**
 * Both the native and LlamaIndex adapters stamp `contentHash` on every node's
 * metadata (lib/ai/rag/ingestion/{native,llamaindex}-adapter.ts). Recomputing
 * here is a defensive fallback only, in case a future adapter omits it — the
 * indexer must never fail a write over a missing hash.
 */
function resolveNodeContentHash(node: IngestionNode): string {
  const fromAdapter = node.metadata["contentHash"];
  return typeof fromAdapter === "string" ? fromAdapter : computeContentHash(node.text);
}

/**
 * Shared best-effort telemetry callbacks for `resolveIngestionNodes`, used by
 * both the product-listing and FAQ reindex handlers. Extracted so the
 * console.warn wiring isn't duplicated verbatim between the two call sites
 * (pure dedup — same messages/behavior as before).
 */
function createIngestionTelemetryCallbacks(organizationId: string): {
  recordAdapterFailure: (failure: IngestionAdapterFailure) => void;
  recordShadowComparison: (comparison: ShadowIngestionComparison) => void;
} {
  return {
    recordAdapterFailure: (failure) => {
      console.warn(
        `[rag-indexer] ingestion adapter fallback (${failure.mode}) for org ${organizationId}: ${failure.reason}`,
      );
    },
    recordShadowComparison: (comparison) => {
      console.warn(
        `[rag-indexer] ingestion shadow comparison for org ${organizationId}: ` +
          `native=${comparison.nativeNodeCount} llamaindex=${comparison.llamaIndexNodeCount} ` +
          `delta=${comparison.nodeCountDelta} textMatches=${comparison.textMatches} ` +
          `degraded=${comparison.degraded}${comparison.reason ? ` reason=${comparison.reason}` : ""}`,
      );
    },
  };
}

/**
 * Chunk metadata provenance fields, split so each describes a different
 * thing: `ingestion_mode` is what's actually persisted in this row's
 * `content` (only ever "native" or "llamaindex" — shadow mode always writes
 * the native adapter's output, per resolveIngestionNodes's contract), while
 * `resolver_mode` is what mode the resolver ran under for this document,
 * which can additionally be "shadow". Collapsing both into one
 * `ingestion_mode: selection.mode` field made shadow-mode rows claim
 * `ingestion_mode: "shadow"` even though the content in the row was always
 * native's output — misleading for anyone querying provenance later.
 */
function resolveChunkModeFields(
  mode: IngestionAdapterMode,
): { ingestion_mode: "native" | "llamaindex"; resolver_mode: IngestionAdapterMode } {
  return {
    ingestion_mode: mode === "llamaindex" ? "llamaindex" : "native",
    resolver_mode: mode,
  };
}

/**
 * Loads the default active agent for the org.
 * Returns null when no agent is configured.
 */
async function resolveAgent(
  organizationId: string,
): Promise<{ id: string; active_kb_version_id: string | null } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_agents")
    .select("id, organization_id, active_kb_version_id, is_active, is_default")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    id: (data as { id: string }).id,
    active_kb_version_id:
      (data as { active_kb_version_id: string | null }).active_kb_version_id ?? null,
  };
}

/**
 * Validates that `agentId` really is an active agent of `organizationId`
 * before trusting it as the event's target — an event payload is
 * server-authored (see callers), but this still enforces tenant scope
 * explicitly rather than trusting a bare id.
 */
async function resolveAgentById(
  organizationId: string,
  agentId: string,
): Promise<{ id: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_agents")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", agentId)
    .eq("is_active", true)
    .maybeSingle();
  return data ? { id: (data as { id: string }).id } : null;
}

/**
 * Loads the decrypted Nuvemshop access token + store ID for the org.
 * Returns null when the integration is not connected.
 */
async function resolveNuvemshopCredentials(
  organizationId: string,
): Promise<{ accessToken: string; storeId: string } | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("tenant_integrations")
    .select("id, organization_id, provider, store_metadata, oauth_access_token_encrypted")
    .eq("organization_id", organizationId)
    .eq("provider", "nuvemshop")
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;

  // store_metadata carries the storeId as { store_id: string } or { id: number }
  const meta = (data as { store_metadata: Record<string, unknown> | null }).store_metadata ?? {};
  const storeId = String(
    meta["store_id"] ?? meta["id"] ?? "",
  );
  if (!storeId) return null;

  // Decrypt the access token via Postgres helper fn_decrypt_oauth.
  // We use RPC to avoid shipping plaintext bytes through the app layer.
  const { data: decrypted, error: decErr } = await admin.rpc(
    "fn_decrypt_oauth" as never,
    {
      p_organization_id: organizationId,
      p_integration_id: (data as { id: string }).id,
    } as never,
  );

  if (decErr || !decrypted) return null;

  const accessToken = String(decrypted);
  if (!accessToken) return null;

  return { accessToken, storeId };
}

/**
 * Fetches a single product from Nuvemshop REST API.
 * Returns null when credentials are unavailable or product not found.
 */
async function fetchNuvemshopProduct(
  organizationId: string,
  productId: string,
): Promise<NuvemshopProduct | null> {
  const creds = await resolveNuvemshopCredentials(organizationId);
  if (!creds) {
    // Wave 4 stub — full Nuvemshop credential resolution implemented in S-06.x
    // Concern: fn_decrypt_oauth RPC may not exist; if so, this returns null gracefully.
    console.warn(
      "[rag-indexer] nuvemshop credentials unavailable for org",
      organizationId,
      "— skipping product fetch (stub path)",
    );
    return null;
  }

  const client = new NuvemshopApiClient({
    storeId: creds.storeId,
    accessToken: creds.accessToken,
  });

  try {
    const product = await client.get<NuvemshopProduct>(`/products/${productId}`);
    return product ?? null;
  } catch (err) {
    console.warn(
      "[rag-indexer] fetchNuvemshopProduct failed",
      productId,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleProductSynced(
  row: EventRow,
  agentId: string,
): Promise<ProcessResult> {
  const productId = String(row.payload["product_id"] ?? "");
  if (!productId) {
    return skip("missing_product_id_in_payload");
  }

  const product = await fetchNuvemshopProduct(row.organization_id, productId);
  if (!product) {
    return skip("product_fetch_failed_or_stub");
  }

  const text = formatProductForRag(product);

  // Chunk generation is delegated to the pluggable ingestion port so the
  // llamaindex adapter (Task 6) can be swapped in per-tenant behind the
  // feature gate without touching this lifecycle. `resolveIngestionNodes`
  // already fails open to the native adapter on canary/on failure; if the
  // resolution call itself throws (e.g. feature-flag lookup error), no
  // version has been created yet, so the currently active version is
  // untouched — same safety as a chunking failure today.
  // Shadow mode's whole purpose is measuring the adopt/reject signal for
  // llamaindex — without telemetry the worker pays double chunking cost and
  // produces zero observable output. Counts/booleans only, per
  // ShadowIngestionComparison's own contract: never tenant text.
  const telemetry = createIngestionTelemetryCallbacks(row.organization_id);

  let selection: IngestionSelectionResult;
  try {
    selection = await resolveIngestionNodes({
      organizationId: row.organization_id,
      document: {
        text,
        metadata: {
          organizationId: row.organization_id,
          sourceId: productId,
          sourceVersion: row.id,
          title: `Produto ${productId}`,
        },
      },
      recordAdapterFailure: telemetry.recordAdapterFailure,
      recordShadowComparison: telemetry.recordShadowComparison,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { type: "error", detail: `ingestion_resolution_failed: ${detail}` };
  }

  const nodes = selection.nodes;

  if (nodes.length === 0) {
    return skip("no_chunks_generated");
  }

  // Create a new version in 'building' status.
  const { versionId, versionNumber } = await createKnowledgeVersion({
    agentId,
    organizationId: row.organization_id,
    sourceType: "nuvemshop_product",
  });

  console.warn(
    `[rag-indexer] created version ${versionNumber} (${versionId}) for org ${row.organization_id}`,
  );

  // Embed and upsert each chunk.
  const admin = createAdminClient();
  let successCount = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const content = node.text;
    if (!content) continue;
    const contentHash = resolveNodeContentHash(node);

    let embedding: number[];
    try {
      const result = await embedText(content, { organizationId: row.organization_id });
      embedding = result.embedding;
    } catch (err) {
      // If embedding fails mid-way, abort and fail the version.
      const detail = err instanceof Error ? err.message : String(err);
      return { type: "error", detail: `embed_failed at chunk ${i}: ${detail}` };
    }

    // Upsert chunk — conflict on (organization_id, kb_version_id, content_hash) → do nothing
    const { error: upsertErr } = await admin
      .from("ai_chunks")
      .upsert(
        {
          organization_id: row.organization_id,
          kb_version_id: versionId,
          knowledge_source_id: null, // product-level indexing; source link deferred to S-06.05
          position: i,
          content,
          content_hash: contentHash,
          // NOT NULL no banco. Nenhum dos dois caminhos preenchia, e todo
          // insert morria com "null value in column token_count".
          token_count: estimateTokens(content),
          embedding: embedding as unknown as string,
          metadata: {
            source_type: "nuvemshop_product",
            product_id: productId,
            ...resolveChunkModeFields(selection.mode),
          },
        },
        {
          // A constraint que existe no banco e ai_chunks_position_unique
          // (knowledge_source_id, kb_version_id, position). O alvo antigo
          // (organization_id, kb_version_id, content_hash) nao existe, e o
          // Postgres respondia "there is no unique or exclusion constraint
          // matching the ON CONFLICT specification" — TODO chunk falhava ao
          // gravar. Como cada reindexacao cria uma versao nova, na pratica
          // nunca ha conflito; o alvo certo e o que faz o insert passar.
          onConflict: "knowledge_source_id,kb_version_id,position",
          ignoreDuplicates: true,
        },
      );

    if (upsertErr) {
      // Log but don't fail the whole version for a single chunk upsert error.
      console.warn(
        `[rag-indexer] chunk upsert error at position ${i}:`,
        upsertErr.message,
      );
    } else {
      successCount++;
    }
  }

  // NUNCA ativar versão vazia. Se todos os chunks falharem, marcar 'ready' com
  // zero e ativar troca uma base que funcionava por uma base VAZIA — o agente
  // perde o RAG em silêncio, que é pior que a indexação ter falhado. Falhando
  // aqui, a versão anterior continua ativa.
  if (successCount === 0) {
    await markVersionFailed(versionId, row.organization_id, "nenhum chunk gravado");
    return { type: "error", detail: "no_chunks_written" };
  }

  await markVersionReady(versionId, row.organization_id, successCount);
  await activateVersion({
    agentId,
    versionId,
    organizationId: row.organization_id,
  });

  return { type: "ok", versionId, chunkCount: successCount };
}


/**
 * Reindexa a base de conhecimento do tenant (FAQ, política) — S-06.05/06/07.
 *
 * Decisão de arquitetura: **reconstrói UMA versão com TODAS as fontes**, em vez
 * de uma versão por fonte. A busca (`retrieve_top_k_chunks`) recebe um único
 * `kb_version_id`, e o agente aponta para uma única versão ativa
 * (`ai_agents.active_kb_version_id`). Se cada fonte criasse a própria versão,
 * ativar o FAQ desativaria o catálogo e vice-versa — o RAG degradaria em
 * silêncio, que é pior que não ter.
 *
 * Custo: re-embeddar tudo a cada mudança. Para a base de um tenant (dezenas de
 * itens) são centavos, e a alternativa incremental exigiria diferenciar chunk a
 * chunk. Caminho de evolução, quando a base crescer: reaproveitar os chunks
 * cujo `content_hash` não mudou da versão anterior.
 *
 * A versão só é ATIVADA depois de todos os chunks entrarem: se algo falhar no
 * meio, a versão anterior continua valendo e o agente segue respondendo com a
 * base antiga em vez de ficar sem base nenhuma.
 */
async function handleKnowledgeSourceUpdated(
  row: EventRow,
  agentId: string,
): Promise<ProcessResult> {
  const admin = createAdminClient();

  const { data: sourceRows, error: srcErr } = await admin
    .from("ai_knowledge_sources")
    .select("id, source_type, name")
    .eq("organization_id", row.organization_id)
    .eq("agent_id", agentId)
    .eq("status", "ready");
  if (srcErr) return { type: "error", detail: `sources_query_failed: ${srcErr.message}` };

  const sources = (sourceRows ?? []) as { id: string; source_type: string; name: string }[];
  if (sources.length === 0) return skip("no_sources");

  const { data: itemRows, error: itemErr } = await admin
    .from("ai_faq_items")
    .select("knowledge_source_id, question, answer, position")
    .eq("organization_id", row.organization_id)
    .in("knowledge_source_id", sources.map((s) => s.id))
    .order("position", { ascending: true });
  if (itemErr) return { type: "error", detail: `items_query_failed: ${itemErr.message}` };

  const items = (itemRows ?? []) as {
    knowledge_source_id: string;
    question: string;
    answer: string;
  }[];
  if (items.length === 0) return skip("no_content_to_index");

  // Feature/adapter selection is resolved ONCE for the whole event, not once
  // per FAQ item: resolveAiPlatformFeature does 2 Supabase round trips per
  // call, so resolving inside the loop cost 2N extra DB round trips for N
  // items, a flag lookup failure on item 50 aborted the whole reindex, and a
  // flag flipped mid-loop could tag chunks of the SAME knowledge version with
  // mixed ingestion_mode provenance. Chunking itself (adapter.normalize)
  // still runs per item below via resolveIngestionNodes — only the
  // feature-flag lookup is cached and reused for every item, via the
  // `resolveFeature` override that returns the same resolution every time.
  let resolvedFeature: ResolvedAiPlatformFeature;
  try {
    resolvedFeature = await resolveAiPlatformFeature({
      organizationId: row.organization_id,
      feature: "llamaindex",
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { type: "error", detail: `ingestion_resolution_failed: ${detail}` };
  }
  const resolveFeatureOnce = async (): Promise<ResolvedAiPlatformFeature> => resolvedFeature;
  const telemetry = createIngestionTelemetryCallbacks(row.organization_id);

  // Um chunk por par pergunta/resposta: a unidade de recuperação é a resposta
  // inteira. O adaptador de ingestão só sub-divide quando a resposta é longa
  // demais para um chunk — assim uma FAQ curta nunca é picada no meio. Cada
  // item ainda passa pelo adaptador individualmente (mesma granularidade de
  // antes, quando cada item ia direto para `chunkText`) — apenas a resolução
  // do feature flag acima é compartilhada entre todos os itens.
  const porFonte = new Map(sources.map((s) => [s.id, s]));
  const pedacos: {
    content: string;
    sourceId: string;
    sourceType: string;
    node: IngestionNode;
    resolverMode: IngestionAdapterMode;
  }[] = [];
  for (const it of items) {
    const fonte = porFonte.get(it.knowledge_source_id);
    if (!fonte) continue;
    const texto = `Pergunta: ${it.question}\nResposta: ${it.answer}`;
    let selection: IngestionSelectionResult;
    try {
      selection = await resolveIngestionNodes({
        organizationId: row.organization_id,
        document: {
          text: texto,
          metadata: {
            organizationId: row.organization_id,
            sourceId: fonte.id,
            sourceVersion: row.id,
            title: fonte.name,
          },
        },
        resolveFeature: resolveFeatureOnce,
        recordAdapterFailure: telemetry.recordAdapterFailure,
        recordShadowComparison: telemetry.recordShadowComparison,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { type: "error", detail: `ingestion_resolution_failed: ${detail}` };
    }
    for (const node of selection.nodes) {
      pedacos.push({
        content: node.text,
        sourceId: fonte.id,
        sourceType: fonte.source_type,
        node,
        resolverMode: selection.mode,
      });
    }
  }
  if (pedacos.length === 0) return skip("no_chunks_generated");

  const { versionId, versionNumber } = await createKnowledgeVersion({
    agentId,
    organizationId: row.organization_id,
    sourceType: "knowledge_source",
  });
  console.warn(
    `[rag-indexer] reconstruindo base: versão ${versionNumber} (${versionId}), ` +
      `${sources.length} fonte(s), ${pedacos.length} chunk(s)`,
  );

  let gravados = 0;
  const gravadosPorFonte = new Map<string, number>();
  for (let i = 0; i < pedacos.length; i++) {
    const p = pedacos[i]!;
    const contentHash = resolveNodeContentHash(p.node);
    let embedding: number[];
    try {
      const r = await embedText(p.content, { organizationId: row.organization_id });
      embedding = r.embedding;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      await markVersionFailed(versionId, row.organization_id, `embed_failed@${i}: ${detail}`);
      return { type: "error", detail: `embed_failed at chunk ${i}: ${detail}` };
    }
    const { error: upErr } = await admin.from("ai_chunks").upsert(
      {
        organization_id: row.organization_id,
        kb_version_id: versionId,
        knowledge_source_id: p.sourceId,
        position: i,
        content: p.content,
        content_hash: contentHash,
        token_count: estimateTokens(p.content),
        embedding: embedding as unknown as string,
        metadata: { source_type: p.sourceType, ...resolveChunkModeFields(p.resolverMode) },
      },
      // Ver comentario no caminho de produto: esta e a constraint que existe.
      { onConflict: "knowledge_source_id,kb_version_id,position", ignoreDuplicates: true },
    );
    if (upErr) {
      console.warn(`[rag-indexer] chunk upsert error at ${i}:`, upErr.message);
    } else {
      gravados++;
      gravadosPorFonte.set(p.sourceId, (gravadosPorFonte.get(p.sourceId) ?? 0) + 1);
    }
  }

  // NUNCA ativar versão vazia. Se todos os chunks falharem, marcar 'ready' com
  // zero e ativar troca uma base que funcionava por uma base VAZIA — o agente
  // perde o RAG em silêncio, que é pior que a indexação ter falhado. Falhando
  // aqui, a versão anterior continua ativa.
  if (gravados === 0) {
    await markVersionFailed(versionId, row.organization_id, "nenhum chunk gravado");
    return { type: "error", detail: "no_chunks_written" };
  }

  await markVersionReady(versionId, row.organization_id, gravados);
  await activateVersion({ agentId, versionId, organizationId: row.organization_id });

  // Estado por fonte: a tela mostra "Chunks indexados" e a última indexação.
  const agora = new Date().toISOString();
  for (const s of sources) {
    // `conversations` nunca tem ai_faq_items — é alimentada por um pipeline
    // dedicado (lib/ai/rag/ingest/conversations.ts via cron
    // kb-conversations-batch), não por este reindex genérico baseado em FAQ.
    // Sem este skip, doFonte é sempre 0 aqui e a fonte é marcada `failed` a
    // cada rodada mesmo quando o pipeline dela nunca rodou ou está saudável.
    if (s.source_type === "conversations") continue;

    // O que REALMENTE entrou, nao o que eu pretendia gravar: contar o planejado
    // fazia a tela anunciar "4 chunks indexados" com zero chunks no banco.
    const doFonte = gravadosPorFonte.get(s.id) ?? 0;
    await admin
      .from("ai_knowledge_sources")
      .update({
        last_index_status: doFonte > 0 ? "success" : "failed",
        last_index_error: doFonte > 0 ? null : "nenhum chunk foi gravado nesta indexação",
        last_indexed_at: agora,
        chunks_count: doFonte,
      })
      .eq("id", s.id)
      .eq("organization_id", row.organization_id);
  }

  return { type: "ok", versionId, chunkCount: gravados };
}

// ---------------------------------------------------------------------------
// Main processor — exported for handler adapter + unit tests
// ---------------------------------------------------------------------------

export async function processRagIndexer(row: EventRow): Promise<HandlerResult> {
  const consumerKey = "rag-indexer.v1";

  // Lag monitor (IA-11)
  const lagMs = Date.now() - new Date(row.payload["created_at"] as string ?? row.id).getTime();
  if (lagMs > LAG_WARN_MS) {
    console.warn(
      `[rag-indexer] lag exceeded 5min: ${Math.round(lagMs / 1000)}s for event ${row.id} (${row.event_type})`,
    );
  }

  // Guard: embedding provider must be configured.
  if (!isEmbeddingProviderConfigured()) {
    return { consumer_key: consumerKey, status: "skipped", detail: "openai_key_missing" };
  }

  // Resolve which agent this event is actually about. `knowledge_source.updated`
  // always carries the real owner in `payload.agent_id` (both emitters —
  // POST /api/v1/ai/knowledge/sources and its reindex route — set it from the
  // source row, never guessed). Falling back to "the org's default agent" here
  // silently reindexed the DEFAULT agent's knowledge on every non-default
  // agent's upload/reindex — a multi-agent org's Nina/Rui/Sofia-style agents
  // never got their own content embedded, the event still reported "done".
  let agentId: string;
  try {
    const payloadAgentId = row.payload["agent_id"];
    const agent =
      typeof payloadAgentId === "string"
        ? await resolveAgentById(row.organization_id, payloadAgentId)
        : null;
    if (agent) {
      agentId = agent.id;
    } else {
      const fallback = await resolveAgent(row.organization_id);
      if (!fallback) {
        return { consumer_key: consumerKey, status: "skipped", detail: "agent_inactive_or_missing" };
      }
      agentId = fallback.id;
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[rag-indexer] resolveAgent failed:", detail);
    return { consumer_key: consumerKey, status: "error", detail };
  }

  // Debounce key scoped to (org, agent, event_type) to coalesce bursts.
  const debounceKey = `rag:debounce:${row.organization_id}:${agentId}:${row.event_type}`;
  const acquired = await acquireDebounce(debounceKey, DEBOUNCE_TTL_SEC);
  if (!acquired) {
    return { consumer_key: consumerKey, status: "skipped", detail: "debounced" };
  }

  let versionId: string | undefined;

  try {
    let result: ProcessResult;

    switch (row.event_type) {
      case "nuvemshop.product_synced":
        result = await handleProductSynced(row, agentId);
        break;

      case "knowledge_source.updated":
        result = await handleKnowledgeSourceUpdated(row, agentId);
        break;

      default:
        return { consumer_key: consumerKey, status: "skipped", detail: `unhandled_event:${row.event_type}` };
    }

    if (result.type === "skip") {
      return { consumer_key: consumerKey, status: "skipped", detail: result.reason };
    }

    if (result.type === "error") {
      if (versionId) {
        await markVersionFailed(versionId, row.organization_id, result.detail).catch(() => {
          // best-effort
        });
      }
      return { consumer_key: consumerKey, status: "error", detail: result.detail };
    }

    // type === "ok"
    versionId = result.versionId;
    return {
      consumer_key: consumerKey,
      status: "ok",
      detail: `version=${result.versionId} chunks=${result.chunkCount}`,
    };
  } catch (err) {
    // Global catch — worker must NOT throw.
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[rag-indexer] unhandled error:", detail);

    if (versionId) {
      await markVersionFailed(versionId, row.organization_id, detail).catch(() => {
        // best-effort
      });
    }

    return { consumer_key: consumerKey, status: "error", detail };
  }
}
