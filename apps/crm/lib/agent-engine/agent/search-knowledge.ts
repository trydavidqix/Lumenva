/**
 * RAG no turno do engine (Fase 0 da convergência — spec 2026-07-23).
 *
 * Busca top-K na KB publicada do agente via RPC retrieve_top_k_chunks
 * (SECURITY DEFINER + filtro programático de org — o caller passa o org da
 * ROW do job, fonte confiável). Erros viram ensino ao modelo, convenção do
 * harness: { ok:false, error } — nunca exceção.
 */
import { randomUUID } from 'node:crypto';
import type pg from 'pg';

import { embedText } from '@/lib/ai/embed';
import type { Citation } from '@/lib/ai/citations/types';
import type { AiTraceSpan, AiTracer } from '../obs/ai-tracing';
import { opaqueTenantId } from '../obs/external-redaction';
import type { Logger } from '../obs/logger';

export interface KnowledgeHit {
  chunk_id: string;
  knowledge_source_id: string | null;
  content: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
}

export type SearchKnowledgeResult =
  | { ok: true; results: KnowledgeHit[] }
  | { ok: false; error: { code: string; message: string } };

/** Piso real da similaridade de cosseno — `1 - distância`, com distância em [0,2]. */
const PISO_SIMILARIDADE = -1;

export async function searchKnowledge(
  pool: pg.Pool,
  args: {
    organizationId: string;
    kbVersionId: string;
    query: string;
    topK: number;
    threshold: number;
    /** Só para telemetria — opcional, os chamadores de hoje seguem válidos. */
    jobId?: string | null;
  },
  deps?: { embed?: typeof embedText; log?: Logger; tracer?: AiTracer; traceId?: string; parentRunId?: string },
): Promise<SearchKnowledgeResult> {
  const embed = deps?.embed ?? embedText;
  let span: AiTraceSpan | undefined;
  if (deps?.tracer !== undefined) {
    try {
      span = await deps.tracer.startSpan({
        name: 'knowledge_search',
        runId: randomUUID(),
        traceId: deps.traceId ?? args.jobId ?? randomUUID(),
        parentRunId: deps.parentRunId,
        organizationId: args.organizationId,
        // Query text and retrieved chunks can carry PII, so this seam exports
        // retrieval metadata only.
        metadata: {
          organization_id: opaqueTenantId(args.organizationId),
          ...(args.jobId ? { job_id: args.jobId } : {}),
          kb_version_id: args.kbVersionId,
          top_k: args.topK,
          threshold: args.threshold,
        },
      });
    } catch {
      // Tracing must never prevent retrieval.
    }
  }
  try {
    const { embedding } = await embed(args.query, { organizationId: args.organizationId });
    const vec = `[${embedding.join(',')}]`;

    // Pedimos ao banco SEM limiar (piso da similaridade) e cortamos aqui. O
    // conjunto entregue ao modelo é o mesmo de antes — `order by` é por
    // distância e o `limit` vem depois do `where`, então os K melhores globais
    // já são os K melhores acima do limiar sempre que existirem K deles.
    // (Não é teorema: o corte antigo comparava o float8 cru contra o limiar e
    // este compara o float4 já arredondado da RPC. Na janela de ~3e-8 entre os
    // dois os caminhos divergem, e a direção depende de para que lado o limiar
    // arredonda ao virar `real` — `p_threshold` é real, e 0.72 arredonda para
    // cima enquanto 0.7 e 0.9 arredondam para baixo. Não é "mais permissivo":
    // é divergência nas duas direções, conforme o limiar configurado.)
    //
    // O que ganhamos é o `top_score`: a similaridade do melhor candidato mesmo
    // quando ela não passa. Sem isso, "a base não tem essa informação" e "a base
    // tem e o corte está apertado demais" são indistinguíveis — e são problemas
    // com consertos opostos.
    const { rows } = await pool.query<KnowledgeHit>(
      `select chunk_id, knowledge_source_id, content, similarity, metadata
       from retrieve_top_k_chunks($1, $2, $3::vector, $4, $5)`,
      [args.organizationId, args.kbVersionId, vec, args.topK, PISO_SIMILARIDADE],
    );

    const results = rows.filter((r) => r.similarity >= args.threshold).map(redactKnowledgeHit);
    // Sem depender da ordem das linhas. O `filter` descarta o NaN que o pgvector
    // devolve para chunk de embedding zerado — ele contaminaria o `Math.max` e
    // anularia o top_score de linhas BOAS na mesma busca (numa KB com poucos
    // chunks, um único chunk defeituoso cegaria o painel para toda busca dela).
    // Sobra o array vazio, cujo `Math.max()` é -Infinity: é o `Number.isFinite`
    // abaixo que o transforma em `null` — `numeric` aceitaria 'NaN' e envenenaria
    // a coluna em silêncio.
    const maiorScore = Math.max(...rows.map((r) => r.similarity).filter(Number.isFinite));
    const topScore = Number.isFinite(maiorScore) ? maiorScore : null;

    // Fire-and-forget: perder telemetria é infinitamente melhor que perder a
    // resposta ao cliente. O `threshold` gravado é o do CHAMADOR, nunca o piso
    // acima — gravar -1 faria toda busca parecer acima do limiar e zeraria o
    // "quase acertou" do painel.
    try {
      await pool.query(
        `insert into knowledge_searches
           (organization_id, job_id, kb_version_id, hits, top_score, threshold)
         values ($1, $2, $3, $4, $5, $6)`,
        [args.organizationId, args.jobId ?? null, args.kbVersionId, results.length, topScore, args.threshold],
      );
    } catch (err) {
      // Engolido de propósito — o `catch` externo transformaria isto em
      // `knowledge_unavailable` e o modelo diria ao cliente que a base caiu, por
      // causa de uma linha de telemetria. Mas NÃO mudo (molde do irmão
      // `ai_router_decisions` em inbound-turn): se o insert falhar sempre, o
      // painel mostra zero buscas, que é indistinguível de "ninguém buscou".
      deps?.log?.warn('busca de conhecimento não registrada', {
        error: (err instanceof Error ? err.message : String(err)).slice(0, 120),
      });
    }

    await endTraceSpan(span, { metrics: { result_count: results.length } });
    return { ok: true, results };
  } catch {
    await endTraceSpan(span, { error: 'knowledge_unavailable' });
    return {
      ok: false,
      error: {
        code: 'knowledge_unavailable',
        message: 'a base de conhecimento está indisponível agora — responda com o que você já sabe e não invente fatos.',
      },
    };
  }
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CPF_PATTERN = /\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/g;
const PHONE_PATTERN = /(?<!\d)(?:\+\d{1,3}[\s.-]?)?(?:\d[\s.-]?){8,14}\d(?!\d)/g;

function redactText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, '[EMAIL_REDACTED]')
    .replace(CPF_PATTERN, '[CPF_REDACTED]')
    .replace(PHONE_PATTERN, '[PHONE_REDACTED]');
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, redactValue(child)]),
    );
  }
  return value;
}

/** Mandatory consumer-boundary redaction; there is intentionally no opt-out. */
export function redactKnowledgeHit(hit: KnowledgeHit): KnowledgeHit {
  const content = redactText(hit.content);
  const metadata = hit.metadata === null
    ? null
    : redactValue(hit.metadata) as Record<string, unknown>;
  return content === hit.content && metadata === hit.metadata
    ? hit
    : { ...hit, content, metadata };
}

async function endTraceSpan(
  span: AiTraceSpan | undefined,
  input: Parameters<AiTraceSpan['end']>[0],
): Promise<void> {
  if (span === undefined) return;
  try {
    await span.end(input);
  } catch {
    // Tracing must never change retrieval behavior.
  }
}

/** Shape que a UI do inbox já renderiza (CitationsPanel — lib/ai/citations/types). */
export function citationsFromHits(hits: KnowledgeHit[]): Citation[] {
  return hits.map((h) => {
    const redacted = redactKnowledgeHit(h);
    return {
      chunk_id: redacted.chunk_id,
      knowledge_source_id: redacted.knowledge_source_id,
      score: redacted.similarity,
      snippet: redacted.content.slice(0, 240),
      ...(redacted.metadata !== null ? { metadata: redacted.metadata } : {}),
    };
  });
}
