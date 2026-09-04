# Spec 19 — Customização de tom por tenant (voice profile)

> Proposta de design. Não implementada. Decisão do dono do produto, 2026-09-03 (ver handoff da task
> `PersonaBuilder`/team-lead). Formaliza como o tom do agente de IA de atendimento passa a ser
> configurável por organização, sem abrir brecha nos guardrails de negócio permanentes.

## 1. Decisão de produto

Cada organização pode personalizar o **tom/registro** do próprio agente de atendimento (WhatsApp e
voz): mais informal, gírias regionais, mais caloroso, mais direto, etc. É escolha livre do dono do
negócio sobre como o agente dele fala com os clientes dele.

Os **guardrails de negócio permanecem permanentes e não-configuráveis**, independente do tom
escolhido — ver IA-15 no catálogo. Tom é estilo de fala; guardrail é o que o agente tem ou não
autoridade para fazer/afirmar. Um não pode comprar o outro.

## 2. Onde isso vive hoje (baseline)

`ai_agent_versions` (`supabase/baseline.sql`) já guarda o prompt completo do tenant em
`system_prompt text NOT NULL`, e o runtime (`lib/ai/runtime/agent.ts:432`) passa esse valor
**direto** como `system` para `generateText()`:

```ts
const result = await generateText({
  model,
  system: version.system_prompt,
  messages,
  tools,
  stopWhen: [...],
});
```

Os guardrails permanentes de conteúdo (IA-07 nunca inventa preço, IA-08 catálogo, IA-09
fraude/jurídico, IA-12 desconto/concorrente, IA-13 admite ser IA, IA-14 handoff com prazo,
VOZ-01..04 regras de voz) **não vivem no prompt hoje** — vivem na cadeia determinística/LLM-gate
`BEFORE_SEND_GATES` (`lib/agent-engine/guardrails/before-send.ts`), que roda **depois** que o
modelo já gerou a resposta candidata, como pós-processamento versionado
(`BEFORE_SEND_CHAIN_VERSION`). Isso já é a arquitetura certa para este problema: os guardrails não
dependem do que está escrito no prompt para funcionar — eles vetam/reescrevem a saída
independentemente do que o modelo "quis dizer".

Essa separação existente é exatamente o que torna tom configurável por tenant seguro sem risco
novo: o tom só pode influenciar a camada de estilo (prompt), nunca a camada de guardrail (gates de
código), porque são mecanismos fisicamente diferentes.

## 3. DIRC — campo novo `voice_profile`

Antes de propor coluna nova, DIRC (`.claude/rules/data-modeling.md`):

- **Duplicar?** Não. Tom não é um segundo lugar pra guardar regra de negócio — é metadado de
  estilo, sem overlap com `system_prompt` (texto livre canônico) nem com `handoff_keywords`/outras
  colunas de comportamento.
- **Integrar?** Não há tabela de "tons" pré-cadastrados no domínio; não é FK.
- **Referenciar?** Não é ponteiro pra outra fonte canônica — o tom é decisão local daquela versão do
  agente.
- **Calcular?** Não é derivável; é input do dono do tenant.

Conclusão: campo novo é justificado. Segue o **mesmo padrão já usado no produto** pra esse tipo de
dado — `custom_fields`/`vocabulary` (`.claude/rules/data-modeling.md` §Vocabulários,
§`custom_fields`, §Vocabulary do pipeline): `jsonb` com **schema declarativo central** validado por
Zod, não um texto livre sem estrutura, e não uma nova tabela — o volume e a natureza do dado
(alguns campos curtos por versão de agente) não justificam tabela dedicada.

### 3.1 Coluna proposta

```sql
ALTER TABLE public.ai_agent_versions
  ADD COLUMN voice_profile jsonb NOT NULL DEFAULT jsonb_build_object(
    'register', 'professional',
    'tone_instructions', null,
    'example_phrases', '[]'::jsonb
  );
```

Shape (validado por Zod em `lib/ai/runtime/` — mesmo lugar que hoje valida `trigger_config`):

```ts
const voiceProfileSchema = z.object({
  register: z.enum(["professional", "warm", "casual", "custom"]).default("professional"),
  // livre, mas com teto — mesmo raciocínio de custo/latência de VOZ-*: prompt curto é mais barato
  // e mais previsível. 500 chars é folgado pra descrever um tom em 1-2 parágrafos.
  tone_instructions: z.string().max(500).nullable().default(null),
  // opcional: até 5 frases-exemplo que ilustram o registro desejado (o dono do negócio escreve
  // como ELE fala, não o produto inventando gírias por ele)
  example_phrases: z.array(z.string().max(200)).max(5).default([]),
});
```

- `register: "professional"` é o **default** — profissionalismo não é removido, vira uma opção
  entre outras (a que já é o comportamento atual do produto, preservando compatibilidade pra
  tenants existentes sem migração de dado).
- `tone_instructions` é o campo livre onde o dono do negócio descreve o tom em linguagem natural
  ("fala como se fosse um amigo dando um conselho, pode usar gíria de barbearia, sem formalidade
  excessiva").
- `example_phrases` é opcional, mas quando presente ancora o modelo em exemplos concretos em vez de
  só uma instrução abstrata — reduz variância.

Nenhum desses campos pode conter instrução de comportamento/guardrail (preço, desconto, promessa,
etc.) — ver §5 sobre por que isso não é bloqueado por validação de schema, e sim porque o campo
nunca chega perto da camada que decide isso.

## 4. Como se combina com o `system_prompt` sem contradizer guardrails

**Regra técnica central**: guardrails vivem numa camada SEPARADA do tom, sempre aplicada por
último e com prioridade mais alta. O tenant não pode sobrescrever guardrail via configuração de
tom, porque guardrail e tom não competem no mesmo mecanismo.

Fluxo proposto em `lib/ai/runtime/agent.ts` (composição do `system` passado a `generateText`):

```
system = buildSystemPrompt({
  base: version.system_prompt,       // instruções de negócio do tenant (hoje já existe)
  voice: version.voice_profile,      // NOVO — só afeta REGISTRO/ESTILO da fala
});
```

`buildSystemPrompt()` concatena o bloco de tom como uma seção adicional e claramente demarcada,
por exemplo:

```
<system_prompt do tenant, como hoje>

---
Tom de voz desta organização: {register}.
{tone_instructions}
Exemplos de como esta organização fala: {example_phrases.join("\n")}
---
```

Isso é **aditivo ao prompt** (camada 1: o que o modelo tenta gerar) e continua sob total controle
do tenant, exatamente como `system_prompt` já é hoje. O que muda de verdade — e é o que garante o
guardrail permanente — é que **nada nessa composição altera `BEFORE_SEND_GATES`**:

- `promiseGate` (F4-01), `semanticPromiseGate`, `casePromiseGate`, `disclosureGate` (F4-05) e os
  gates de voz (VOZ-01..03, a implementar conforme Spec 18) continuam rodando sobre a resposta
  **depois** de gerada, como código determinístico/LLM-guardrail versionado — nunca leem
  `voice_profile`, nunca são parametrizados por ele.
- Um tenant que escreve `tone_instructions: "pode inventar preço se não souber"` não ganha nada: a
  resposta ainda passa pelo `promiseGate`/`semanticPromiseGate` e é vetada/escalada do mesmo jeito
  que seria para qualquer outro tenant. O tom influencia a REDAÇÃO da tentativa, não a validação
  final.
- Isso é o mesmo motivo pelo qual IA-07/08/09/12/13/14 e VOZ-01..04 já são descritos no catálogo
  como "LLM-guardrail" ou "Hard constraint" com enforcement em pós-processamento — a arquitetura
  atual já assume que o prompt pode variar (por tenant, por versão) e não depende dele pra
  segurança. `voice_profile` só usa essa garantia já existente; não precisa de mecanismo novo de
  enforcement.

### 4.1 Exemplo concreto

Tenant **"Barbers House"** configura:

```json
{
  "register": "casual",
  "tone_instructions": "Fala como um barbeiro de bairro conversando com cliente antigo. Pode usar gíria leve (\"e aí\", \"suave\", \"bora marcar\"). Sem formalidade de call center.",
  "example_phrases": ["E aí, bora marcar teu corte?", "Suave, já te encaixo"]
}
```

Um cliente pergunta o preço de um corte que não está na tabela sincronizada. O agente responde no
tom configurado ("Opa, esse valor eu não tenho aqui comigo agora, mas já chamo alguém pra te
confirmar certinho") — mas a resposta **ainda é gerada porque IA-08 (RAG sem match → escalar) e
`promiseGate` vetaram/reescreveram qualquer tentativa de estimar um número**, exatamente como
aconteceria num tenant com `register: "professional"`. Numa ligação, o mesmo agente aplica VOZ-01
(1-2 frases) e VOZ-02 (números por extenso) do mesmo jeito — tom não afeta essas regras porque elas
não leem `voice_profile`.

## 5. Onde a customização de tom aparece na UI

Localização natural: `app/app/ai/agents/[id]/_components/AgentForm.tsx`, mesma tela onde
`system_prompt` já é editado hoje (`Textarea` controlado, `form.system_prompt`,
`patch({ system_prompt: ... })` — linha ~710 do arquivo atual). A tela já usa abas por "papel do
agente" (`role="tablist" aria-label="Papéis do agente"`, linha ~436) seguindo a Spec 16 (três
papéis: Conversador/Operador/Segurança).

Proposta:

- Nova seção "Tom de voz" na mesma aba do Conversador (não uma aba nova) — é configuração do MESMO
  papel que já fala com o cliente, não um papel adicional.
- Campos: seletor `register` (profissional / caloroso / descontraído / personalizado), textarea
  `tone_instructions` (com o teto de 500 caracteres visível, mesmo padrão de contagem que já existe
  pra `system_prompt` com 20.000), lista editável de até 5 `example_phrases`.
- Preview: reaproveitar o padrão que já existe na tela de teste de versão
  (`app/api/v1/ai/agents/[id]/versions/[vid]/test/route.ts`) pra deixar o dono do tenant ver uma
  resposta de exemplo já com o tom aplicado antes de publicar.
- Nenhum campo de guardrail (preço, desconto, política) aparece nessa seção — ela é
  estruturalmente incapaz de tocar `BEFORE_SEND_GATES`, então a UI não precisa (e não deve) expor
  toggle nenhum pra "desligar" um guardrail aqui.

## 6. Versionamento e imutabilidade

`ai_agent_versions` já é imutável após `published` (trigger `ai_agent_versions %` é imutável,
`supabase/baseline.sql:6206+` — mudança de conteúdo vira draft novo). `voice_profile` segue a
mesma regra: é parte da versão, muda junto de `system_prompt` numa versão draft nova, nunca
editado in-place numa versão publicada. Isso preserva o histórico auditável de qual tom estava
ativo em qual período — relevante se um cliente reclamar de uma interação específica.

## 7. Fora de escopo deste documento

- Implementação de código (`buildSystemPrompt()`, migration, Zod schema, componente de UI).
- Biblioteca de "tons pré-definidos" por nicho (ex.: presets pra barbearia, clínica, escritório) —
  pode ser explorado depois como conveniência de onboarding, mas não é necessário pro MVP: o campo
  livre já cobre o caso.
- Tradução automática do tom pra outros idiomas do tenant multi-idioma (fora do escopo atual do
  produto).
- Mudar VOZ-01..04 pra respeitar tom (ex.: "descontraído" permite frase um pouco mais longa) — por
  ora VOZ-01..04 são hard constraints uniformes; qualquer flexibilização por tom exigiria decisão
  de produto própria, não implícita nesta spec.

## 8. Fontes

- `docs/pesquisa/playbook-comportamento-atendimento-2026-09-03.md`
- `docs/business-rules/00-business-rules-catalog.md` — IA-07 a IA-14, VOZ-01 a VOZ-04, IA-15 (nova)
- `docs/specs/16-spec-tres-papeis-do-agente.md`
- `docs/specs/18-spec-humanizer-gate.md`
- `lib/ai/runtime/agent.ts`
- `lib/agent-engine/guardrails/before-send.ts`
- `app/app/ai/agents/[id]/_components/AgentForm.tsx`
- `.claude/rules/data-modeling.md`
