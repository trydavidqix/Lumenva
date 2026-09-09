import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * O modelo pode terminar um `inbound_turn` com texto pronto e nunca chamar
 * `send_message` — nenhum gate roda (eles vivem dentro do execute da tool),
 * nenhum erro é lançado, e o log final (`turno do agente concluído`,
 * `messages_sent: 0`) fica idêntico ao de um turno que legitimamente não
 * precisava responder (follow-up, handoff). Achado ao vivo num teste E2E
 * adversarial: um pedido de compra sem tool de pagamento produziu 300 tokens
 * de resposta e ZERO envio, em silêncio total.
 *
 * Este guard prova que o alerta está de fato escrito no código que roda — não
 * que um turno real dispara o `agent_inbox_items` (isso exigiria o harness
 * real de turno, documentado como ausente/caro em `send-template-wiring.test.ts`).
 */
const FONTE = fs.readFileSync(
  path.join(process.cwd(), "lib/agent-engine/agent/inbound-turn.ts"),
  "utf8",
);

function corpoDoAlerta(): string {
  const i = FONTE.indexOf("O modelo pode terminar o turno com texto pronto");
  expect(i, "âncora do alerta de turno silencioso sumiu").toBeGreaterThan(-1);
  const j = FONTE.indexOf("await mcpCleanup?.();", i);
  expect(j, "âncora de fim (mcpCleanup) sumiu").toBeGreaterThan(i);
  return FONTE.slice(i, j);
}

describe("alerta de turno sem envio — só dispara onde o cliente está esperando", () => {
  it("só roda em inbound_turn — follow-up/operador podem legitimamente não responder", () => {
    expect(corpoDoAlerta()).toMatch(/job\.kind === 'inbound_turn'/);
  });

  it("exige as duas condições: zero envio E o modelo tinha algo a dizer", () => {
    const corpo = corpoDoAlerta();
    expect(corpo).toMatch(/outcomes\.length === 0/);
    expect(corpo).toMatch(/turn\.result\.text\.trim\(\) !== ''/);
  });

  it("não muda comportamento de envio — só loga e alerta (nível 1, não auto-reenvio)", () => {
    // O ponto do achado é tornar visível, não decidir sozinho reenviar texto
    // não vetado pelos gates. Um `channel.send(` aqui seria o fix de risco
    // maior (nível 2), que foi explicitamente adiado.
    const corpo = corpoDoAlerta();
    expect(corpo).not.toMatch(/channel\.send\(/);
    expect(corpo).toMatch(/runLog\.warn\(/);
  });

  it("o alerta operacional é deduplicado por episódio aberto, como o handoff nativo", () => {
    const corpo = corpoDoAlerta();
    expect(corpo).toMatch(/insert into agent_inbox_items/);
    expect(corpo).toMatch(/where not exists/);
    expect(corpo).toMatch(/status = 'open'/);
  });

  it("usa o kind aberto ('other') e a severity real do vocabulário — não abre constraint nova", () => {
    // docs/.claude/rules/data-modeling.md: vocabulário fechado não vira "completo"
    // só porque um caso novo apareceu. `other` já é o balde de propósito geral de
    // `agent_inbox_items_kind_check` — reusar evita migration para um alerta de nível 1.
    //
    // 'warn', não 'warning': agent_inbox_items_severity_check só aceita
    // info|warn|critical (baseline.sql). A 1ª versão deste código usava
    // 'warning' e passava em typecheck/lint/teste — só um INSERT real contra
    // Postgres acusa CHECK constraint, e este arquivo (só leitura de fonte,
    // sem DB) não prova isso sozinho. Achado ao vivo em produção: o próprio
    // alerta de nível 1 disparou de verdade e falhou ao gravar por causa
    // deste exato erro. Ver tests/invariants para o equivalente com DB real.
    expect(corpoDoAlerta()).toMatch(/kind, severity, title, body, ref_kind, ref_id\)\s*\n\s*select \$1, 'other', 'warn', /);
  });

  it("falha ao gravar o alerta não derruba o turno — mesma disciplina fire-and-forget do handoff", () => {
    const corpo = corpoDoAlerta();
    expect(corpo).toMatch(/} catch \(err\) \{[\s\S]{0,700}runLog\.error\('falha ao registrar alerta de turno sem envio/);
    // .message, não .name — .name devolvia "error" pra QUALQUER DatabaseError do pg,
    // sem dizer qual constraint. Foi exatamente essa perda de informação que escondeu
    // o bug 'warning'/'warn' até alguém ler o erro na mão.
    expect(corpo).toMatch(/err instanceof Error \? err\.message\.slice\(0, 200\)/);
  });
});
