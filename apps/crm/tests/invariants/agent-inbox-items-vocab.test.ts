/**
 * `agent_inbox_items` — os literais de `kind`/`severity` que o código escreve
 * PRECISAM bater com os CHECK constraints do baseline, e isso só um INSERT
 * real contra Postgres prova. `severity` aceita só 'info'|'warn'|'critical'
 * (baseline.sql) — não 'warning'.
 *
 * Achado ao vivo em produção (2026-08-22): o alerta de nível 1 de
 * `inbound-turn.ts` (turno sem envio) usava `severity: 'warning'`. Passou em
 * typecheck, lint e no guard de source-inspection (`silent-turn-alert.test.ts`,
 * que só lê o arquivo como texto — nunca toca banco). O primeiro sinal real
 * foi o próprio worker falhando ao gravar o alerta, silenciosamente
 * (fire-and-forget, por desenho), num turno de cliente de verdade.
 *
 * Este arquivo fecha a lacuna: prova, contra o schema real, que cada
 * combinação (kind, severity) que o código de fato escreve é aceita.
 */
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GOV_ORG, seedGov } from "./gov-helpers";

const PORTA = process.env.TEST_DB_PORT ?? "54329";
const pool = new pg.Pool({
  connectionString: `postgres://postgres:postgres@127.0.0.1:${PORTA}/postgres`,
  max: 2,
});

beforeAll(async () => {
  seedGov();
});

afterAll(async () => {
  await pool.end();
});

/** Cada linha é um site real de escrita no código — kind/severity literais. */
const SITES_REAIS: Array<{ nome: string; kind: string; severity: string }> = [
  { nome: "human-handoff.ts (d) inbox de escalação", kind: "handoff", severity: "critical" },
  { nome: "metrics.ts alerta de cache_hit baixo", kind: "other", severity: "warn" },
  { nome: "inbound-turn.ts alerta de turno sem envio", kind: "other", severity: "warn" },
];

describe("agent_inbox_items — vocabulário que o código escreve bate com o CHECK real", () => {
  for (const site of SITES_REAIS) {
    it(`${site.nome}: (kind='${site.kind}', severity='${site.severity}') insere sem erro`, async () => {
      const { rows } = await pool.query<{ id: string }>(
        `insert into agent_inbox_items (organization_id, kind, severity, title, body, ref_kind, ref_id)
         values ($1, $2, $3, 'título de teste', 'corpo de teste', 'contact', gen_random_uuid())
         returning id`,
        [GOV_ORG, site.kind, site.severity],
      );
      expect(rows[0]?.id).toBeDefined();
      await pool.query(`delete from agent_inbox_items where id = $1`, [rows[0]!.id]);
    });
  }

  it("'warning' (o valor que o bug real usava) é REJEITADO pelo CHECK — prova que o teste acima não é vácuo", async () => {
    await expect(
      pool.query(
        `insert into agent_inbox_items (organization_id, kind, severity, title, body)
         values ($1, 'other', 'warning', 'x', 'x')`,
        [GOV_ORG],
      ),
    ).rejects.toThrow(/agent_inbox_items_severity_check/);
  });
});
