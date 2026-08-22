import { describe, expect, it } from "vitest";

/**
 * O CONTRATO do webhook deste canal. Adaptado de melgarafael/DeskcommCRM
 * PR #278 (issue #237) — reimplementado à mão porque o cherry-pick direto
 * conflitava demais com o estado atual do fork.
 *
 * Metade dos casos prova que o schema RECUSA o que fazia a ingestão estourar
 * calada. A outra metade prova que ele NÃO recusa mais nada — que é o risco
 * de verdade desta mudança: um webhook de WhatsApp real traz campos que
 * ninguém catalogou, e um schema apertado demais troca "mensagem entra no
 * CRM" por "mensagem descartada em silêncio", que é pior que o defeito
 * consertado.
 *
 * Por isso o payload REAL é medido inteiro, com `toEqual` contra o que
 * `JSON.parse` produzia sozinho: se um campo se perder no caminho, o teste diz.
 */
import { conferirContratoWaha, lerRoteamentoWaha } from "@/lib/waha/envelope";
import { parseChatId } from "@/lib/waha/ingest";

const REAL = {
  event: "message",
  session: "default",
  payload: {
    id: "false_553198966398@c.us_3A60443E83484256AF03",
    from: "553198966398@c.us",
    to: "551140028922@c.us",
    fromMe: false,
    body: "oi, tudo bem?",
    type: "chat",
    timestamp: 1_760_000_000,
    hasMedia: false,
    _data: {
      notifyName: "Cliente Real",
      pushName: "Cliente Real",
      message: { conversation: "oi, tudo bem?" },
    },
  },
};

const lerEnvelopeWaha = (rawBody: string) => {
  const r = lerRoteamentoWaha(rawBody);
  return r.ok ? conferirContratoWaha(r.envelope) : r;
};

describe("o payload real atravessa inteiro", () => {
  it("aceita o evento e devolve o MESMO objeto que o cast devolvia", () => {
    const cru = JSON.stringify(REAL);
    const r = lerEnvelopeWaha(cru);

    expect(r.ok).toBe(true);
    // Nada de `toMatchObject`: o que se quer provar é que nada SUMIU.
    expect(r.ok && r.envelope).toEqual(JSON.parse(cru));
  });

  it("campo que ninguém catalogou passa intacto — é o risco desta issue", () => {
    const comNovidade = {
      ...REAL,
      campoDoFuturo: { qualquer: [1, 2, 3] },
      payload: { ...REAL.payload, replyTo: "abc", _data: { ...REAL.payload._data, novo: true } },
    };
    const r = lerEnvelopeWaha(JSON.stringify(comNovidade));

    expect(r.ok).toBe(true);
    expect(r.ok && r.envelope).toEqual(comNovidade);
  });

  it("`null` é ausência, não erro — é como todo provider diz 'não tenho'", () => {
    const r = lerEnvelopeWaha(
      JSON.stringify({ event: "message", session: "default", payload: { id: "x", body: null, to: null, media: null } }),
    );
    expect(r.ok).toBe(true);
  });

  it("evento sem payload nenhum continua passando (ack, status, presença)", () => {
    expect(lerEnvelopeWaha(JSON.stringify({ event: "session.status", session: "default" })).ok).toBe(true);
  });
});

describe("o payload fora do contrato é recusado, e o campo é nomeado", () => {
  const recusa = (payload: Record<string, unknown>): string[] => {
    const r = lerEnvelopeWaha(JSON.stringify({ event: "message", session: "default", payload }));
    if (r.ok) throw new Error("o schema ACEITOU um payload que devia recusar");
    expect(r.motivo).toBe("contrato_violado");
    return [...r.campos].sort();
  };

  it("`from` não-string — o campo que fazia a ingestão estourar", () => {
    expect(recusa({ id: "x", from: 5 })).toEqual(["payload.from"]);
  });

  it("sem o contrato, esse mesmo valor LANÇAVA lá dentro", () => {
    // `parseChatId` chama `.endsWith`; com um valor não-string, lança.
    expect(() => parseChatId(5 as unknown as string)).toThrow(TypeError);
  });

  it("nomeia TODOS os campos recusados, não só o primeiro", () => {
    expect(recusa({ id: "x", from: 2, timestamp: "agora", body: 7 })).toEqual([
      "payload.body",
      "payload.from",
      "payload.timestamp",
    ]);
  });

  it("o estágio 1 recusa o que ele mesmo lê — a sessão e o id que vão para o arquivo", () => {
    const r = lerRoteamentoWaha(JSON.stringify({ session: 1, payload: { id: 2 } }));
    if (r.ok) throw new Error("o estágio de roteamento ACEITOU o que devia recusar");
    expect([...r.campos].sort()).toEqual(["payload.id", "session"]);
  });

  it("corpo que nem é objeto não vira envelope vazio", () => {
    expect(lerEnvelopeWaha('"sou uma string"').ok).toBe(false);
    expect(lerEnvelopeWaha("[1,2,3]").ok).toBe(false);
  });

  it("json quebrado é motivo PRÓPRIO — o corpo é outra coisa que o formato", () => {
    const r = lerEnvelopeWaha("{nao é json");
    expect(r).toMatchObject({ ok: false, motivo: "json_invalido", campos: [] });
  });

  it("a recusa carrega o CAMINHO e nunca o valor — que é dado de cliente", () => {
    // O valor aqui tem 20 mil caracteres e é um telefone repetido. Se ele
    // vazasse para `campos`, iria parar no log e no corpo da resposta.
    const enorme = "5531988887777".repeat(1500);
    expect(recusa({ id: "x", timestamp: enorme })).toEqual(["payload.timestamp"]);
  });
});
