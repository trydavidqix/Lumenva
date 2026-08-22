/**
 * O CONTRATO do que chega no webhook deste canal — declarado, e não presumido.
 *
 * Antes daqui o corpo entrava por `JSON.parse(rawBody) as WahaEnvelope`: um
 * **cast**, que é uma promessa do autor ao compilador e nada mais. Em tempo de
 * execução o campo podia ser o que quisesse, e a rota não tinha como saber.
 *
 * Adaptado de melgarafael/DeskcommCRM PR #278 (issue #237) — sem os campos
 * `_data.key.remoteJid*`/`participant*` do upstream (feature @lid alternate
 * phone que este fork não tem ainda); tudo mais mantido.
 *
 * ─── O que o cast custava, medido ───────────────────────────────────────────
 *
 * `payload.from` vai direto para `parseChatId`, que chama `.endsWith`. Com um
 * `from` não-string a chamada LANÇA, o `try/catch` da rota engole (no handler
 * do dispatch), e a requisição pode devolver **200** — o provider risca o
 * evento da fila achando que entregou. Descarte mudo com carimbo de sucesso,
 * no caminho que ingere mensagem de cliente.
 *
 * ─── A REGRA deste arquivo (leia antes de acrescentar campo) ────────────────
 *
 * Um campo ganha tipo quando o código o consome **sem guarda própria** — é aí
 * que o tipo errado vira exceção engolida ou descarte mudo. Campo que o código
 * já trata em qualquer forma (`typeof x === "object"`) fica `z.unknown()`, e
 * campo que ninguém lê não entra: o objeto é **loose**, então o desconhecido
 * passa intacto.
 *
 * Apertar além disso é a regressão que este arquivo existe para não causar. Um
 * webhook de WhatsApp real traz campos que ninguém catalogou; um `.strict()` ou
 * um obrigatório a mais transforma "mensagem entra no CRM" em "mensagem
 * descartada", que é pior que o defeito consertado aqui.
 *
 * `.nullish()` em tudo pelo mesmo motivo: `null` é como todo provider escreve
 * "não tenho este campo".
 */
import { z } from "zod";

import { conferirEnvelope, lerEnvelope, type LeituraDeEnvelope } from "@/lib/webhooks/contrato";

const texto = z.string().nullish();
const numero = z.number().nullish();
const booleano = z.boolean().nullish();

/** WAHA >= 2026.x (NOWEB): a mídia vem aninhada aqui. */
const wahaMediaSchema = z.looseObject({
  url: texto,
  mimetype: texto,
  filename: texto,
});

export const wahaPayloadSchema = z.looseObject({
  id: texto,
  from: texto,
  to: texto,
  fromMe: booleano,
  body: texto,
  type: texto,
  hasMedia: booleano,
  ack: numero,
  ackName: texto,
  participant: texto,
  author: texto,
  status: texto,
  timestamp: numero,
  mediaUrl: texto,
  mimetype: texto,
  media: wahaMediaSchema.nullish(),
  /** Id da mensagem ORIGINAL nos eventos `message.edited` / `message.revoked`. */
  editedMessageId: texto,
  revokedMessageId: texto,
  _data: z
    .looseObject({
      notifyName: texto,
      pushName: texto,
      /**
       * O conteúdo NOWEB (`imageMessage`, `stickerMessage`, …). Fica sem tipo
       * de propósito: `dispatchWahaEvent` já checa forma antes de olhar as
       * chaves, então exigir objeto aqui só criaria uma forma nova de
       * descartar a mensagem inteira.
       *
       * ⚠️ O `.optional()` NÃO é enfeite: no Zod 4 um `z.unknown()` solto
       * dentro de um objeto é OBRIGATÓRIO (a chave ausente reprova com
       * `expected nonoptional`). Sem ele, todo payload sem `_data.message` —
       * inclusive ack — seria recusado.
       */
      message: z.unknown().optional(),
    })
    .nullish(),
});

export const wahaEnvelopeSchema = z.looseObject({
  event: texto,
  session: texto,
  payload: wahaPayloadSchema.nullish(),
});

export type WahaPayload = z.infer<typeof wahaPayloadSchema>;
export type WahaEnvelope = z.infer<typeof wahaEnvelopeSchema>;

/**
 * ─── Por que a conferência acontece em DOIS momentos ────────────────────────
 *
 * As duas rotas gravam `webhook_events_log` (raw_body + payload_parsed) ANTES
 * de despachar o evento — o corpo cru de um payload cujo formato mudou é o
 * artefato que responde O QUE mudou, e conferir o contrato inteiro antes do
 * INSERT destruiria essa evidência caso o contrato reprove.
 *
 * O estágio 1 confere só o que a rota precisa ANTES de poder arquivar: a
 * sessão (que resolve o tenant) e o id da mensagem (coluna do próprio
 * arquivo). O estágio 2 confere o resto, depois do INSERT.
 */
export const wahaRoteamentoSchema = z.looseObject({
  event: texto,
  session: texto,
  payload: z.looseObject({ id: texto }).nullish(),
});

export type WahaRoteamento = z.infer<typeof wahaRoteamentoSchema>;

/** Estágio 1 — o mínimo para resolver o tenant e arquivar o corpo. */
export function lerRoteamentoWaha(rawBody: string): LeituraDeEnvelope<WahaRoteamento> {
  return lerEnvelope(rawBody, wahaRoteamentoSchema);
}

/**
 * Estágio 2 — o contrato completo, sobre o que o estágio 1 já desserializou.
 *
 * Reconferir o objeto do estágio 1 equivale a reconferir o corpo original: o
 * schema é `loose` em todo nível, então o que ele devolve tem as MESMAS
 * chaves que entraram.
 */
export function conferirContratoWaha(roteado: WahaRoteamento): LeituraDeEnvelope<WahaEnvelope> {
  return conferirEnvelope(roteado, wahaEnvelopeSchema);
}
