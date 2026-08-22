import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * O CONTRATO do webhook da Cloud API. Adaptado de melgarafael/DeskcommCRM
 * PR #278 (issue #237) — reimplementado à mão porque o cherry-pick direto
 * conflitava demais com o estado atual do fork.
 *
 * A ordem dos casos é a da dúvida: primeiro que os payloads REAIS produzem
 * exatamente os mesmos eventos de antes (prova que ninguém apertou demais),
 * depois que o payload torto para de virar 500.
 *
 * O 500 não é hipótese: `parseMetaWebhook` faz `for (const entry of
 * envelope.entry ?? [])`, e `for...of` sobre um número LANÇA. A rota não tem
 * `try/catch` em volta, então a Meta receberia 5xx e reentregaria o mesmo
 * corpo em backoff — indefinidamente, porque ele nunca vai melhorar.
 */
import { lerEnvelopeMeta } from "@/lib/channels/meta/envelope";
import { parseMetaWebhook } from "@/lib/channels/meta/webhook";

/** Payloads REAIS capturados da WABA de teste — os mesmos de `meta-webhook-inbound.test.ts`. */
const REAIS = JSON.parse(readFileSync("tests/fixtures/meta/inbound-webhooks.json", "utf8")) as unknown[];

describe("os payloads reais atravessam inteiros", () => {
  it.each(REAIS.map((p, i) => [i, p] as const))("payload real #%i passa e nada some", (_i, cru) => {
    const r = lerEnvelopeMeta(JSON.stringify(cru));
    expect(r.ok).toBe(true);
    expect(r.ok && r.envelope).toEqual(cru);
  });

  it("o parser produz EXATAMENTE os mesmos eventos com e sem o schema no meio", () => {
    // Prova de não-regressão: se o schema tivesse comido um campo, a lista de
    // eventos mudaria — e é ela que vira mensagem no inbox.
    for (const cru of REAIS) {
      const validado = lerEnvelopeMeta(JSON.stringify(cru));
      expect(validado.ok).toBe(true);
      expect(validado.ok && parseMetaWebhook(validado.envelope)).toEqual(
        parseMetaWebhook(cru as Parameters<typeof parseMetaWebhook>[0]),
      );
    }
  });

  it("campo desconhecido no envelope, na entry e na change passa intacto", () => {
    const comNovidade = {
      object: "whatsapp_business_account",
      campoDoFuturo: 1,
      entry: [{ id: "waba-1", time: 123, changes: [{ field: "messages", value: {}, extra: true }] }],
    };
    const r = lerEnvelopeMeta(JSON.stringify(comNovidade));
    expect(r.ok).toBe(true);
    expect(r.ok && r.envelope).toEqual(comNovidade);
  });

  it("o miolo de `value` NÃO é apertado — quem o lê já trata qualquer forma", () => {
    const r = lerEnvelopeMeta(
      JSON.stringify({
        object: "whatsapp_business_account",
        entry: [{ id: "w", changes: [{ field: "messages", value: { messages: "nem é lista", metadata: 7 } }] }],
      }),
    );
    expect(r.ok).toBe(true);
  });

  it("envelope de outro produto (`object: page`) passa no contrato e o parser é quem ignora", () => {
    const r = lerEnvelopeMeta(JSON.stringify({ object: "page", entry: [{ id: "x" }] }));
    expect(r.ok).toBe(true);
    expect(r.ok && parseMetaWebhook(r.envelope)).toEqual([]);
  });
});

describe("o payload fora do contrato é recusado, e o campo é nomeado", () => {
  const recusa = (corpo: unknown): string[] => {
    const r = lerEnvelopeMeta(JSON.stringify(corpo));
    if (r.ok) throw new Error("o schema ACEITOU um payload que devia recusar");
    expect(r.motivo).toBe("contrato_violado");
    return [...r.campos].sort();
  };

  it("`entry` que não é lista — o campo que virava 500", () => {
    expect(recusa({ object: "whatsapp_business_account", entry: 3 })).toEqual(["entry"]);
  });

  it("sem o contrato, esse mesmo valor LANÇAVA no parser", () => {
    expect(() => parseMetaWebhook({ object: "whatsapp_business_account", entry: 3 } as never)).toThrow(TypeError);
  });

  it("`changes` que não é lista, e `value` que não é objeto", () => {
    expect(recusa({ object: "whatsapp_business_account", entry: [{ id: "w", changes: 1 }] })).toEqual([
      "entry.0.changes",
    ]);
    expect(
      recusa({ object: "whatsapp_business_account", entry: [{ id: "w", changes: [{ value: "texto" }] }] }),
    ).toEqual(["entry.0.changes.0.value"]);
  });

  it("json quebrado é motivo PRÓPRIO", () => {
    expect(lerEnvelopeMeta("{nao é json")).toMatchObject({ ok: false, motivo: "json_invalido" });
  });
});
