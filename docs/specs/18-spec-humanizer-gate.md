---
title: DeskcommCRM — Spec 18: Gate de humanização (before_send)
version: 0.1
status: proposto (design, não implementado)
date: 2026-09-03
owner: David William
---

# Spec 18 — Gate de humanização (`before_send`)

> Documento de design. Não há código nesta spec — é o input para quem for implementar,
> com plano próprio de execução (`writing-plans`/`test-driven-development`).
> Contexto/pesquisa: `docs/pesquisa/playbook-comportamento-atendimento-2026-09-03.md` §4.
> Regras de negócio relacionadas: `docs/business-rules/00-business-rules-catalog.md` IA-12,
> IA-13, VOZ-01 a VOZ-04.

## 1. Problema

Mesmo com grounding e guardrails corretos, o texto bruto que o LLM produz tende a sair com
padrões que soam como "bot corporativo genérico" em vez da voz da marca: entusiasmo forçado
("Ótima pergunta! 😊"), fórmulas do tipo "não é só X, é Y", disclaimers de modelo, elogio à
pergunta do próprio cliente. Nenhum dos guardrails existentes na cadeia `before_send`
(`lib/agent-engine/guardrails/before-send.ts`) cobre isso — eles vetam/anotam conteúdo
(preço, promessa, vazamento de vocabulário interno, disclosure), não **estilo**.

## 2. Decisão de arquitetura

1. **O humanizer roda como transformação LEVE/determinística, não como chamada nova de
   modelo de IA.** Custo e latência de uma segunda chamada de LLM por mensagem enviada não se
   justificam para um problema resolvível por reescrita baseada em padrão (dicionário de
   frases/fórmulas proibidas + regras de reescrita). Isso mantém a doutrina da Spec 16 §3.3
   ("chamada de modelo só onde regra não alcança").
2. **Integra na cadeia `before_send` já existente**, na mesma família dos gates que
   **reescrevem** o corpo em vez de só aprovar/reprovar — `spinningGate` (F2-12, vetа
   repetição) e, principalmente, `disclosureGate` (F4-05, usa `amendBody` para prependar
   texto). O humanizer segue o padrão de `disclosureGate`: em vez de vetar, ele pode devolver
   `{ pass: true, amendBody: <corpo reescrito> }`.
3. **É VERSIONADO junto dos outros gates.** Entra em `BEFORE_SEND_GATES` (array declarativo
   já existente) e qualquer mudança na composição/ordem da cadeia — incluir este gate pela
   primeira vez incluído — exige bump de `BEFORE_SEND_CHAIN_VERSION` (hoje em 6, passaria a
   7), seguindo o padrão dos comentários de changelog já presentes no topo do arquivo
   (`v1 = ...`, `v2 = ...` etc.) e travado por
   `tests/unit/before-send-chain-shape.test.ts` (ordem, tamanho, versão, unicidade).
4. **Canal de voz usa um gate SEPARADO, não o mesmo do WhatsApp/texto.** Motivo: a voz tem
   restrição de latência (cada token de transformação pesa no tempo até o primeiro áudio, ver
   playbook §1.6) e formato completamente diferente — sem markdown, resposta em 1-2 frases,
   números por extenso (regras VOZ-01/02/03 do catálogo de business rules). Um único gate
   tentando servir os dois formatos criaria um dicionário de reescrita com regras
   condicionais confusas; dois gates pequenos e de propósito único são mais simples de testar
   e de auditar separadamente.

## 3. Onde entra na cadeia

Proposta de posição: **logo após o `internalVocabularyGate` (posição atual 6.7) e antes do
`disclosureGate` (posição atual 7, última)**.

Razão da posição — mesma lógica já documentada no cabeçalho do arquivo para o
`internalVocabularyGate` em relação ao `disclosureGate`: o disclosure é o ÚLTIMO passo porque
ele emenda o corpo com um texto de template do tenant (não escrito pelo modelo), e qualquer
gate que precise inspecionar/reescrever "o que o modelo escreveu" deve rodar ANTES dele. O
humanizer se encaixa nessa mesma regra — ele reescreve o texto do modelo; se rodasse depois do
disclosure, reescreveria (ou pior, poderia distorcer) um template que não é do modelo.

Ordem proposta da cadeia (texto), com o novo gate marcado:

```
(1) stop            — irrevogável
(2) lgpd             — conformidade
(3) pacing           — anti-ban
(3.5) messaging_window
(4) spinning
(5) promise
(6) semantic_promise
(6.5) case_promise
(6.7) internal_vocabulary
(6.8) humanizer      <- NOVO — transformação, não veto
(7) disclosure       — última, pode emendar o corpo
```

## 4. Contrato do gate (shape, sem implementação)

Segue exatamente a interface `Gate` já existente (`lib/agent-engine/guardrails/before-send.ts`):

```ts
interface Gate {
  readonly name: string; // 'humanizer'
  evaluate(ctx: GateContext): GateVerdict;
}
```

- **Não é veto.** O humanizer nunca deve retornar `{ pass: false, ... }` — soar como IA não é
  motivo para recusar o envio (isso corromperia o objetivo: o cliente ficaria sem resposta por
  um problema de estilo, não de segurança/conformidade). Ele sempre `pass: true`, opcionalmente
  com `amendBody`.
- Quando o texto bate um padrão do dicionário, devolve `{ pass: true, amendBody: <reescrito> }`
  — o mesmo mecanismo que `disclosureGate` já usa; os gates seguintes na cadeia (`disclosure`)
  veem o corpo já reescrito, igual ao runner hoje já propaga `ctx.body = verdict.amendBody`.
- Quando o texto não bate nenhum padrão, devolve `{ pass: true }` sem `amendBody` — sem
  reescrita desnecessária.
- Precisa de um novo campo em `GateContext` (paralelo a `internalVocabularyEnforced`) para
  decidir se o gate está armado — por exemplo `humanizerEnforced?: boolean` — seguindo a
  mesma doutrina de default seguro documentada no arquivo: ausente = desarmado (no-op), para
  não quebrar retrocompatibilidade em caminhos determinísticos (`followup-turn.ts`) onde não
  há ninguém para "aprender" com uma reescrita malfeita e o risco de over-correction é maior
  que o de deixar o texto original passar.

## 5. Gate de voz (separado)

Nome proposto: `voice_format` (ou equivalente — decisão de nomenclatura fica para quem
implementar). Não é uma variante do `humanizer` — é um gate distinto, com dicionário de regras
próprio, cobrindo apenas o canal de voz:

- Corte de resposta para 1-2 frases (VOZ-01).
- Conversão de número/data/valor para extenso (VOZ-02).
- Garantia de sinal de fim de turno — geralmente checar se a resposta termina em pergunta
  direta ou inserir uma (VOZ-03).
- **Não cobre barge-in (VOZ-04)** — interrupção do usuário é tratada na camada de transporte
  de áudio (runtime de voz), não no texto antes do envio; está fora do escopo deste gate e
  desta cadeia `before_send` baseada em texto.

Este gate só se aplica quando `ctx.provider` é o canal de voz — segue o mesmo padrão já usado
por `messagingWindowGate`/`pacingGate` de consultar `capabilitiesOf(ctx.provider)` para saber
se a restrição se aplica, e registrar `skipped: 'not_applicable'` (não um `pass` silencioso)
quando o canal não é voz — a mesma distinção que a doutrina do arquivo já exige para preservar
a diferença entre "não regrediu" e "provo que não regrediu" (invariante 4 de
`docs/doctrine/restricao-de-canal.md`).

Este gate de voz também entraria em `BEFORE_SEND_GATES` com seu próprio bump de versão — não
precisa necessariamente estar na mesma posição do `humanizer`; quem implementar decide a
posição exata olhando se alguma regra de voz depende de outro gate já ter rodado (ex.: faz
sentido cortar para 1-2 frases DEPOIS do disclosure/humanizer já terem potencialmente alterado
o corpo, para não cortar no meio de um texto que ainda vai crescer).

## 6. O que fica para quem implementar

Este documento não resolve (propositalmente):

- O dicionário exato de padrões/frases proibidas do humanizer (fonte natural: a skill
  `humanizer` já instalada no repo/harness — avaliar se dá para reaproveisar a lógica dela
  como base, ou se precisa de um dicionário próprio mais restrito/determinístico para rodar
  sem chamada de modelo).
- O algoritmo de conversão número→extenso para voz (PT-PT, já que a operação é europeia —
  ver `.claude/rules/lgpd.md` sobre a migração RGPD/clientela europeia) — biblioteca existente
  vs. implementação própria.
- Como detectar "esta resposta não sinaliza fim de turno" de forma determinística (heurística
  de pontuação/pergunta vs. algo mais sofisticado).
- Testes: seguindo o padrão de `tests/unit/before-send-chain-shape.test.ts`, qualquer novo gate
  entra nesse teste de shape (ordem/tamanho/versão/unicidade) e precisa de teste unitário
  próprio (`tests/unit/gate-humanizer.test.ts` / `tests/unit/gate-voice-format.test.ts`,
  nomenclatura sugerida) cobrindo pass sem reescrita, pass com `amendBody`, e o default
  desarmado (retrocompatibilidade com callers existentes).
- Métricas/trace: se o humanizer deve registrar detalhe estruturado no trace (ex.:
  `detail: { patterns_matched: N }`) para dar visibilidade de quanto texto está sendo
  reescrito, útil para tuning do dicionário — sem nunca logar o corpo (mesma doutrina de
  privacidade de log já aplicada aos outros gates: `detail` carrega números/rótulos, nunca
  texto livre com PII).

## 7. Fontes

- `docs/pesquisa/playbook-comportamento-atendimento-2026-09-03.md` §4
- `lib/agent-engine/guardrails/before-send.ts` (estrutura real da cadeia, lida em 2026-09-03)
- `docs/business-rules/00-business-rules-catalog.md` — IA-12, IA-13, VOZ-01 a VOZ-04
- `docs/specs/16-spec-tres-papeis-do-agente.md` §3.3 (doutrina "chamada de modelo só onde regra não alcança")
- `docs/doctrine/separacao-fala-e-operacao.md` (padrão de gate-rede citado como referência de posicionamento)
