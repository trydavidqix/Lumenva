/**
 * `run_cache_read_ratio` (métrica de 1ª classe do alerta de cache_hit) precisa
 * medir SÓ a chamada `agent_turn` — a única que usa o prefixo estável
 * (lib/agent-engine/edge/llm/stable-prefix.ts). As demais chamadas de um run
 * (checkpoint, stage_classifier, memory_extraction, jailbreak_detect,
 * intent_router, promise_semantic) são classificadores pequenos sem
 * breakpoint de cache — sempre 0%, por desenho, não por defeito.
 *
 * Achado ao vivo em produção (2026-08-22): a query somava TODAS as chamadas
 * do run. `agent_turn` sozinho batia 72.6% de cache hit; a média de todas as
 * chamadas do run ficava em 24.9% — abaixo do alvo de 40%, disparando um
 * alerta falso todo dia. A métrica media a proporção de chamadas que nem
 * tentam cachear, não a saúde do cache.
 */
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CACHE_RATIO_METRIC, recordRunMetrics } from "@/lib/agent-engine/obs/metrics";
import { GOV_CONTACT_1, GOV_ORG, seedGov } from "./gov-helpers";

const PORTA = process.env.TEST_DB_PORT ?? "54329";
const pool = new pg.Pool({
  connectionString: `postgres://postgres:postgres@127.0.0.1:${PORTA}/postgres`,
  max: 2,
});

async function novoJob(kind: "inbound_turn"): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `insert into job_queue (organization_id, contact_id, kind) values ($1, $2, $3) returning id`,
    [GOV_ORG, GOV_CONTACT_1, kind],
  );
  return rows[0]!.id;
}

async function llmCall(
  jobId: string,
  purpose: string,
  inputTokens: number,
  cacheReadTokens: number,
): Promise<void> {
  await pool.query(
    `insert into llm_calls
       (organization_id, contact_id, job_id, purpose, provider, model, input_tokens, cache_read_tokens)
     values ($1, $2, $3, $4, 'anthropic', 'claude-haiku-4-5', $5, $6)`,
    [GOV_ORG, GOV_CONTACT_1, jobId, purpose, inputTokens, cacheReadTokens],
  );
}

async function ratioGravado(jobId: string): Promise<number | null> {
  const { rows } = await pool.query<{ value: number }>(
    `select value from metrics where organization_id = $1 and name = $2 and labels->>'job_id' = $3`,
    [GOV_ORG, CACHE_RATIO_METRIC, jobId],
  );
  return rows[0]?.value ?? null;
}

beforeAll(async () => {
  seedGov();
});

afterAll(async () => {
  await pool.end();
});

describe("run_cache_read_ratio escopado em purpose='agent_turn'", () => {
  it("classificadores sem cache (0%) não arrastam o ratio pra baixo quando agent_turn cacheia bem", async () => {
    const jobId = await novoJob("inbound_turn");
    // Mesma proporção medida ao vivo: agent_turn com cache bom, 5 classificadores
    // pequenos com cache_read_tokens=0 (nunca usam o prefixo estável).
    await llmCall(jobId, "agent_turn", 34113, 20548); // 60.2% sozinho
    await llmCall(jobId, "intent_router", 266, 0);
    await llmCall(jobId, "stage_classifier", 481, 0);
    await llmCall(jobId, "jailbreak_detect", 321, 0);
    await llmCall(jobId, "promise_semantic", 387, 0);
    await llmCall(jobId, "checkpoint", 2218, 0);

    await recordRunMetrics(pool, { id: jobId, organization_id: GOV_ORG, contact_id: GOV_CONTACT_1, kind: "inbound_turn" });

    const ratio = await ratioGravado(jobId);
    expect(ratio).not.toBeNull();
    // Com a query antiga (soma tudo): 20548 / 37786 ≈ 0.544 — já mascarava um
    // pouco, mas o efeito fica muito mais claro num run com mais classificadores
    // (produção real chega a 24.9% de média na janela). O que este teste prova é
    // a ESCOLHA DE ESCOPO: o ratio bate EXATAMENTE agent_turn/agent_turn, não a
    // soma de tudo.
    expect(ratio).toBeCloseTo(20548 / 34113, 6);
  });

  it("run sem NENHUMA chamada agent_turn não grava a métrica (0/0 não vira '0% de cache' mentiroso)", async () => {
    const jobId = await novoJob("inbound_turn");
    await llmCall(jobId, "stage_classifier", 481, 0);
    await llmCall(jobId, "checkpoint", 2218, 0);

    await recordRunMetrics(pool, { id: jobId, organization_id: GOV_ORG, contact_id: GOV_CONTACT_1, kind: "inbound_turn" });

    expect(await ratioGravado(jobId)).toBeNull();
  });

  it("1ª mensagem de uma conversa (agent_turn ESCREVE cache, cache_read=0) grava ratio 0%, não null", async () => {
    const jobId = await novoJob("inbound_turn");
    await llmCall(jobId, "agent_turn", 18000, 0);

    await recordRunMetrics(pool, { id: jobId, organization_id: GOV_ORG, contact_id: GOV_CONTACT_1, kind: "inbound_turn" });

    expect(await ratioGravado(jobId)).toBe(0);
  });
});
