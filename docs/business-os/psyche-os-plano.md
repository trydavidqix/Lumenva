# PsycheOS — Agent Psyche Engine

**Estado:** plano aprovado, não implementar agora  
**Posição:** WAVE 16, última wave, somente depois de todas as Waves 0–15 do `master-blueprint-IMPLEMENTAVEL.md` fecharem  
**Objetivo:** dar a cada agente personalidade, estado emocional e relação persistentes, observáveis e limitados, sem alterar a autoridade, as guardrails ou a política de segurança do agente.

## 1. Limites e princípios

PsycheOS é uma camada de contexto e appraisal. Nunca concede autoridade, muda instruction hierarchy, decide aprovação, executa tools ou substitui Policy/Approval/Evidence Engines. PAD e Plutchik são duas representações do mesmo evento emocional: PAD é o estado contínuo para cálculo; Plutchik é a etiqueta discreta para explicação, UI e logging. Não são motores concorrentes.

As referências de arquitetura são `emotion-engine` (pioneerjeff-labs, MIT) e `Cognitiv` (MIT). `PersonaWeave` (Apache-2.0) é referência secundária de composição. Não copiar código AGPL de Lettuce Engine nem código de licença TBD de ZifaMem para produto comercial; reimplementar conceitos. Todas as libs citadas são pequenas e recentes, sem prova de uso em produção ou tração comunitária; não fazer fork nem assumir maturidade operacional.

## 2. Dados e autoridade

Postgres é a autoridade única. Cada alteração é event-sourced, tenant-scoped, versionada e idempotente. O estado atual é uma projeção reconstituível dos eventos; nenhum prompt escrito pelo modelo pode persistir diretamente.

```sql
create table agent_psyches (
  psyche_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  agent_id text not null, version int not null default 1,
  big_five jsonb not null, emotional_baseline jsonb not null,
  plutchik_baseline jsonb not null, occ_goals jsonb not null default '[]',
  occ_standards jsonb not null default '[]', occ_attitudes jsonb not null default '[]',
  sales_style jsonb, decay_half_life_hours numeric not null default 72,
  status text not null check (status in ('draft','active','retired')),
  source_provenance jsonb not null, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique (organization_id, agent_id, version)
);

create table agent_relationships (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id),
  psyche_id uuid not null references agent_psyches(psyche_id), subject_type text not null,
  subject_id uuid not null, trust numeric(5,4) not null check (trust between 0 and 1),
  affinity numeric(5,4) not null check (affinity between -1 and 1),
  familiarity numeric(5,4) not null check (familiarity between 0 and 1),
  interaction_count int not null default 0, last_interaction_at timestamptz,
  state_version int not null default 1, updated_at timestamptz not null default now(),
  unique (organization_id, psyche_id, subject_type, subject_id)
);

create table psyche_emotion_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id),
  psyche_id uuid not null references agent_psyches(psyche_id), session_id uuid, subject_id uuid,
  event_type text not null, appraisal jsonb not null, pad jsonb not null, plutchik jsonb not null,
  intensity numeric(5,4) not null check (intensity between 0 and 1), source text not null,
  idempotency_key text not null, occurred_at timestamptz not null, created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table psyche_memory_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id),
  psyche_id uuid not null references agent_psyches(psyche_id), subject_id uuid, content jsonb not null,
  valence numeric(5,4) not null check (valence between -1 and 1), emotional_intensity numeric(5,4) not null,
  salience numeric(5,4) not null, half_life_hours numeric not null, strength numeric(5,4) not null,
  source_event_id uuid references psyche_emotion_events(id), last_recalled_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table psyche_turn_traces (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id),
  psyche_id uuid not null references agent_psyches(psyche_id), session_id uuid not null,
  state_before jsonb not null, appraisal jsonb, state_after jsonb not null,
  blocks_used text[] not null, prompt_hash text not null, created_at timestamptz not null default now()
);
```

RLS repete o padrão `organization_id = app.current_organization_id()`. `agent_psyches`, relationships, events, memory e traces têm policies select/insert/update tenant-scoped; service role é a única via de projeção. Teste obrigatório: organização A não lê, escreve ou infere qualquer linha de B.

## 3. Tipos TypeScript

```ts
export type BigFive = { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number };
export type PAD = { pleasure: number; arousal: number; dominance: number; intensity: number };
export type Plutchik = { primary: "joy"|"trust"|"fear"|"surprise"|"sadness"|"disgust"|"anger"|"anticipation"; secondary?: string; intensity: number };
export type OCCAppraisal = { goalId?: string; desirability: number; likelihood: number; agency: "self"|"other"|"circumstance"; standardId?: string; attitudeId?: string; controllability: number };
export type RelationshipState = { trust: number; affinity: number; familiarity: number; interactionCount: number; lastInteractionAt?: string };
export type PsycheMemory = { id: string; content: Record<string, unknown>; valence: number; emotionalIntensity: number; salience: number; halfLifeHours: number; strength: number; updatedAt: string };
export type AgentPsyche = { psycheId: string; agentId: string; version: number; personality: BigFive; emotionalBaseline: PAD; plutchikBaseline: Plutchik; occ: { goals: string[]; standards: string[]; attitudes: string[] }; relationship: RelationshipState; memories: PsycheMemory[]; salesStyle?: SalesStyle };
export type SalesStyle = { pace: "consultative"|"direct"; questionRatio: number; objectionHandling: "explore"|"reframe"|"escalate"; warmth: number; assertiveness: number };
```

## 4. Appraisal, emotion e decay

`preTurn` lê a mensagem, objetivo, estado de sessão, relação e memórias elegíveis. OCC avalia desejabilidade, probabilidade, agência, standards, attitudes e controlabilidade. O resultado atualiza PAD com transição limitada por turno; a mesma transição gera a etiqueta Plutchik. `postTurn` calcula impacto, grava evento idempotente, atualiza relação e cria/atualiza memória somente se salience/intensity ultrapassarem limiar configurado.

Decay: `strength(t) = strength_0 * 2^(-(t-last_recalled_at)/half_life_hours)`. `half_life_hours` deriva de salience e intensidade emocional, com teto configurável; recall atualiza `last_recalled_at`. Expiração remove a memória da composição, não apaga o evento histórico. Nunca inferir diagnóstico clínico ou emoção como facto; guardar appraisal como inferência com provenance.

## 5. Context Composer e hooks

O Composer monta no máximo 15–20 blocos, cada um com `source`, `confidence`, `sensitivity`, `token_cost` e prioridade. Ordem: (1) instruction hierarchy/policy, (2) identidade AgentDefinition, (3) missão, (4) BehaviorContract, (5) autoridade/autonomia, (6) guardrails, (7) objetivo/plano atual, (8) estado de sessão, (9) estado PAD atual, (10) etiqueta Plutchik, (11) personalidade Big Five resumida, (12) appraisal OCC relevante, (13) relationship state, (14) memórias fortes decaídas, (15) factos do cliente, (16) estilo de canal, (17) ferramentas selecionadas, (18) resultado de tool mais recente, (19) handoff pack, (20) schema de saída. Remover blocos P2/P3 quando exceder orçamento; nunca remover policy, identidade, objetivo ou estado crítico.

Hooks no `AgentRuntime`: `preTurn` (load psyche → decay → appraisal → compose) e `postTurn` (classify outcome → update PAD/Plutchik → relationship delta → memory write proposal → trace). Hooks são código do runtime, não Git hooks, e não alteram autoridade nem aprovação. Voz emocional via Hume é opcional e posterior: provider adapter recebe estado aprovado e devolve prosódia; texto, consentimento, safety e fallback continuam determinísticos.

## 6. Exemplo completo — Sales Agent

```ts
const salesPsyche: AgentPsyche = {
  psycheId: "psyche-sales-lumenva-v1", agentId: "sales-agent", version: 1,
  personality: { openness: .62, conscientiousness: .88, extraversion: .70, agreeableness: .76, neuroticism: .22 },
  emotionalBaseline: { pleasure: .35, arousal: .18, dominance: .42, intensity: .20 },
  plutchikBaseline: { primary: "trust", intensity: .20 },
  occ: { goals: ["qualify_without_pressure", "advance_next_action"], standards: ["honest_claims", "consent_before_send"], attitudes: ["customer_is_partner"] },
  relationship: { trust: .50, affinity: .20, familiarity: .05, interactionCount: 0 }, memories: [],
  salesStyle: { pace: "consultative", questionRatio: .35, objectionHandling: "explore", warmth: .78, assertiveness: .55 }
};
```

Exemplo: o lead diz “Está caro”. OCC avalia ameaça ao objetivo com agência do cliente, baixa probabilidade de fecho imediato e standard de não pressionar; PAD transita para pleasure `.10`, arousal `.32`, dominance `.28`, intensidade `.44`; Plutchik etiqueta `fear` secundário `sadness` apenas para telemetria, nunca para expor ao cliente. O Composer mantém warmth `.78`, formula uma pergunta de orçamento/valor e oferece pausa ou follow-up. Se o cliente aceita a proposta, PAD volta gradualmente ao baseline, trust sobe apenas após evidência de interação, e a memória “objeção de preço resolvida com clarificação” recebe decay proporcional à intensidade.

## 7. Integração no Master Blueprint

Wave 16 acrescenta `psyche_id` a cada AgentDefinition da secção 6.4 e ao contexto de sessão. Adiciona `packages/psyche-os/` (`personality/`, `emotion/`, `appraisal/`, `relationships/`, `memory-decay/`, `composer/`, `hooks/`, `providers/hume/`), migrations RLS, `PsycheService` no Session-Aware Runtime, `PsycheContextBlock` no Context Engine, traces no Evidence/Telemetry e evals em Agent Evals. Não altera as Waves 0–15.

## 8. Sequência e DoD (após Wave 15)

P0 schema/RLS + types (6 ED) → P1 appraisal/PAD/Plutchik (8 ED) → P2 decay/memory/relationships (8 ED) → P3 composer/hooks (8 ED) → P4 Sales Agent pilot/evals (6 ED) → P5 Hume adapter opcional (4 ED). Dependências sequenciais P0→P4; P5 só após consentimento, provider contract e fallback. DoD: determinismo com seed; tenant leakage=0; authority unchanged; memory decay testado; PAD/Plutchik coerentes; 20 blocos dentro do budget; pre/post-turn idempotentes; Sales golden conversation passa; nenhuma inferência emocional apresentada como facto.

## 9. Maturidade e manutenção

As bibliotecas citadas são referências de arquitetura, não dependências obrigatórias. Registar licença, versão e provenance antes de qualquer uso; não fazer fork de código imaturo. O primeiro release de PsycheOS deve ser implementação própria, pequena, observável e reversível, com feature flag por agente e rollback para contexto sem psyche.
