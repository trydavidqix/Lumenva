# Núcleo de Ligação — Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o núcleo de ligação como um novo canal de voz plugado no Agent OS existente, sem reorganizar nem duplicar os agentes atuais.

**Architecture:** Telefone entra por Telnyx, passa por LiveKit e por um `Voice Runtime` responsável por STT, TTS, barge-in, silêncio e estado da chamada. Depois disso, o fluxo reutiliza exatamente as fronteiras já existentes do CRM: identidade tenant-scoped, Customer Memory, Intent Router, agentes publicados, Agent OS, Tool Gateway, políticas, human handoff e observabilidade. Voz não cria `Voice Agent`, `Sales Voice Agent` ou qualquer runtime paralelo.

**Tech Stack:** Next.js 16.3, React 19, TypeScript 6, Supabase/Postgres/RLS, Agent OS existente, Customer Memory, canonical `runModelCall`, Telnyx, LiveKit Cloud, provider-neutral STT/TTS ports.

**Spec:** `docs/superpowers/plans/2026-08-23-implementacao-tokens-master-plan.md`

## Global Constraints

- Trabalhar somente em `implementacao-tokens`.
- Não fazer merge para `main` sem autorização explícita separada.
- Não reestruturar Product Agents, Intent Router, Conversador/Operador/Segurança ou Agent Kernel neste plano.
- Não criar agentes específicos por canal.
- Preservar WhatsApp multimodal, Customer Memory, Tool Gateway, approvals, human handoff e observabilidade existentes.
- Organização deve ser resolvida antes do contacto; nunca buscar telefone globalmente entre tenants.
- LLM sempre passa pelo seam/model router canônico; STT/TTS são ports independentes.
- Nenhum preço, estoque, pedido, ETA, consentimento ou identidade pode ser inventado pelo modelo.
- Voz deve degradar com segurança para humano/encerramento quando qualidade de áudio, identidade ou provider não forem confiáveis.

---

## Panorama do núcleo

```text
CLIENTE
  │
  ▼
TELEFONE
  │
  ▼
TELNYX (PSTN/SIP)
  │
  ▼
LIVEKIT (sessão realtime)
  │
  ▼
VOICE RUNTIME
  ├── STT streaming
  ├── TTS streaming
  ├── barge-in
  ├── silêncio / VAD
  ├── estado da chamada
  └── métricas de latência
  │
  ▼
IDENTIDADE TENANT-SCOPED
  │
  ▼
CUSTOMER MEMORY
  │
  ▼
INTENT ROUTER / AGENT OS EXISTENTE
  │
  ▼
AGENTE PUBLICADO EXISTENTE
  │
  ├── Conversador
  ├── Operador
  └── Segurança
  │
  ▼
TOOL GATEWAY / CRM / PEDIDOS / HANDOFF
```

O canal de voz termina na fronteira de entrada do Agent OS. A partir daí, não existe arquitetura especial de voz para raciocínio ou negócio.

---

### Task 1: Contratos do domínio de voz

**Files:**
- Create: `lib/voice/contracts.ts`
- Test: `lib/voice/contracts.test.ts`

**Interfaces:**
- Consumes: ids tenant/contact/agent existentes do CRM.
- Produces: `VoiceCallState`, `VoiceParticipantRole`, `VoiceCallContext`, `VoiceTurnInput`, `VoiceTurnOutput`.

- [ ] Escrever testes para estados válidos da chamada: `queued | ringing | connecting | active | held | transferring | completed | failed | canceled`.
- [ ] Definir participantes `customer | ai_agent | human_agent`.
- [ ] Exigir `organizationId` em qualquer contexto persistível.
- [ ] Exigir `contactId` apenas após identidade resolvida; chamada desconhecida pode começar sem contacto.
- [ ] Rodar testes RED.
- [ ] Implementar contratos mínimos.
- [ ] Rodar GREEN e typecheck.
- [ ] Commit.

### Task 2: Persistência tenant-safe de chamadas

**Files:**
- Create: `lib/voice/repository.ts`
- Create: migration Supabase com timestamp único para `voice_calls` e `voice_call_events`.
- Test: `lib/voice/repository.test.ts`
- Test: `tests/unit/voice-migration-contract.test.ts`

**Interfaces:**
- Consumes: contratos da Task 1.
- Produces: criação/atualização/idempotência de chamadas e eventos.

- [ ] RED: provar que repository/migration ainda não existem.
- [ ] Criar tabelas com `organization_id` obrigatório, `contact_id` nullable, `agent_id` nullable até routing, provider ids mínimos e timestamps.
- [ ] Adicionar idempotência por provider event id + organization.
- [ ] Criar RLS baseada em `fn_user_org_ids()` e sem `using(true)`.
- [ ] Repository sempre recebe `organizationId` explicitamente.
- [ ] Testar Org A permitido / Org B negado estruturalmente.
- [ ] GREEN + tenant lint + DB/RLS gate.
- [ ] Commit.

### Task 3: Configuração de voz por organização

**Files:**
- Create: `lib/voice/config.ts`
- Create/extend: `app/api/v1/voice/config/**`
- Create: `app/app/settings/tenant/voice/**`
- Test: config/RBAC tests.

**Interfaces:**
- Produces: `VoiceTenantConfig`.

- [ ] Definir modos `always_ai | no_answer | after_hours | overflow`.
- [ ] Configurar idioma, timezone, horário comercial, duração máxima, silêncio máximo e destino(s) humano(s).
- [ ] Configurar gravação/transcrição como política separada e explícita.
- [ ] Aplicar RBAC equivalente às settings tenant atuais.
- [ ] Nenhuma credencial Telnyx/LiveKit/STT/TTS deve ser exposta na UI.
- [ ] Testes + typecheck + build.
- [ ] Commit.

### Task 4: Voice Runtime provider-neutral

**Files:**
- Create: `lib/voice/runtime/stt-port.ts`
- Create: `lib/voice/runtime/tts-port.ts`
- Create: `lib/voice/runtime/session.ts`
- Create: `lib/voice/runtime/barge-in.ts`
- Test: `lib/voice/runtime/*.test.ts`

**Interfaces:**
- Consumes: áudio realtime + `VoiceTenantConfig`.
- Produces: transcrições parciais/finais e áudio sintetizado.

- [ ] RED para streaming STT/TTS, interrupção e timeout de silêncio.
- [ ] Definir ports sem dependência Telnyx/LiveKit.
- [ ] Implementar state machine da sessão.
- [ ] Ao detectar fala do cliente durante TTS, cancelar áudio corrente antes do próximo turno.
- [ ] Confidence baixa em número, morada, valor ou data deve produzir pedido de confirmação, não ação de negócio.
- [ ] Medir STT final latency, LLM first-token, TTS first-audio e end-to-end.
- [ ] GREEN + typecheck.
- [ ] Commit.

### Task 5: Adapter Voice Runtime -> Agent OS existente

**Files:**
- Create: `lib/voice/runtime/agent-os-adapter.ts`
- Test: `lib/voice/runtime/agent-os-adapter.test.ts`

**Interfaces:**
- Consumes: transcript final + tenant/contact/session.
- Produces: chamada ao runtime canônico do Agent OS e texto para TTS.

- [ ] RED: assegurar que adapter nunca chama provider LLM diretamente.
- [ ] Hidratar Customer Memory usando `organizationId + contactId` quando conhecido.
- [ ] Entregar sinal ao Intent Router/agente publicado existente.
- [ ] Passar todas as chamadas LLM por `runModelCall`/router econômico.
- [ ] Não copiar lógica de `sales`, `retention`, `crm_operator`, Supervisor ou handoff.
- [ ] Retornar texto já submetido às políticas de saída existentes.
- [ ] Testar que o mesmo agente pode receber turno WhatsApp e turno voz sem duplicação de identidade/config.
- [ ] GREEN + regressões Agent OS.
- [ ] Commit.

### Task 6: LiveKit como transporte realtime

**Files:**
- Create: `lib/voice/livekit/session.ts`
- Create: `lib/voice/livekit/token.ts`
- Create: endpoints server-side necessários.
- Test: `lib/voice/livekit/*.test.ts`

**Interfaces:**
- Consumes: Voice Runtime.
- Produces: sala/session realtime.

- [ ] Criar/join de room somente por servidor confiável.
- [ ] Metadata inclui apenas ids necessários e tenant-scoped.
- [ ] Credenciais privilegiadas nunca chegam ao cliente.
- [ ] Reconexão após falha temporária deve preservar `voice_call_id`.
- [ ] Suportar mute, hold e preparação de transferência.
- [ ] Testes de token scope e reconexão.
- [ ] Commit.

### Task 7: Telnyx PSTN/SIP

**Files:**
- Create: `lib/voice/telnyx/**`
- Create: `app/api/v1/webhooks/telnyx/**`
- Test: Telnyx webhook/signature/idempotency tests.

**Interfaces:**
- Consumes: webhooks/eventos Telnyx.
- Produces: ligação tenant-scoped entrando no LiveKit.

- [ ] Verificar assinatura e rejeitar fail-closed.
- [ ] Deduplicar eventos.
- [ ] Resolver número técnico Telnyx -> organização ANTES de Caller ID.
- [ ] Normalizar E.164.
- [ ] Route inbound para LiveKit/Voice Runtime.
- [ ] Outbound só pode iniciar por ação governada de UI/Tool Gateway.
- [ ] Testar número idêntico de cliente em duas organizações sem cross-tenant lookup.
- [ ] Commit.

### Task 8: Caller ID + Customer Memory

**Files:**
- Create: `lib/voice/identity/resolve-caller.ts`
- Test: `lib/voice/identity/resolve-caller.test.ts`

**Interfaces:**
- Consumes: organização já resolvida + telefone normalizado.
- Produces: contacto conhecido/desconhecido + Customer Memory compacta.

- [ ] Conhecido: resolver exatamente dentro da organização.
- [ ] Desconhecido: iniciar chamada sem inventar identidade e seguir política de criação/proposta de contacto.
- [ ] Hidratar memória rápida antes do primeiro turno quando disponível.
- [ ] Histórico bruto continua sob demanda; não entra automaticamente no prompt.
- [ ] Testar mesmo E.164 em Org A e Org B.
- [ ] Commit.

### Task 9: Transferência humana de voz

**Files:**
- Create: `lib/voice/transfer/adapter.ts`
- Extend: handoff/case existentes somente no adapter necessário.
- Test: `lib/voice/transfer/adapter.test.ts`

**Interfaces:**
- Consumes: human handoff existente + LiveKit/Telnyx.
- Produces: bridge para humano mantendo contexto.

- [ ] Não criar novo `Escalation Agent`.
- [ ] Consumir o handoff/case existente.
- [ ] Levar caller, resumo, últimos trechos relevantes, memória rápida e ação pendente.
- [ ] AI para de falar quando takeover é confirmado.
- [ ] Falha de transferência gera estado explícito e fallback configurado; nunca silêncio.
- [ ] Preservar call/contact/conversation linkage.
- [ ] Commit.

### Task 10: Painel operacional de ligação

**Files:**
- Create: `app/app/ai/voice/**`
- Create: `components/voice/**`
- Modify: `lib/navigation/registry.ts`
- Test: UI/component/E2E mobile tests.

**Interfaces:**
- Consumes: dados reais das Tasks 2–9.
- Produces: superfície `Agente de Ligação` aprovada visualmente.

- [ ] `Agente de Ligação` permanece nome da CENTRAL DE VOZ, não nome de um novo Agent OS agent.
- [ ] Painel: chamadas ativas, fila, estado, duração, latência, caller, agente real selecionado e custo.
- [ ] Controles: mute, hold, transfer, end, todos permission-gated.
- [ ] Assist panel mostra Customer Memory e fatos autoritativos separados de memória derivada.
- [ ] Histórico e detalhe de chamadas.
- [ ] Mobile 390x844 sem sidebar desktop permanente ocupando o viewport ativo.
- [ ] Estados loading/empty/error/offline.
- [ ] E2E + accessibility + build.
- [ ] Commit.

### Task 11: Observabilidade, segurança e gate final

**Files:**
- Extend: observability/evals existentes.
- Create: `docs/evidence/implementacao-tokens/voice-core/**`.

**Interfaces:**
- Produces: evidência para considerar o núcleo de ligação concluído.

- [ ] Correlacionar Telnyx event -> voice_call -> LiveKit room -> Agent OS run -> tool actions -> outcome/handoff.
- [ ] Evals: áudio ruim, identidade incerta, mesmo telefone cross-tenant, prompt injection falada, disconnect provider, falha de transferência, gravação desativada.
- [ ] Verificar que voz e WhatsApp apontam para o mesmo agente publicado e a mesma Customer Memory.
- [ ] Verificar que não foi criado runtime LLM paralelo nem agente específico de voz.
- [ ] Rodar typecheck, unitários, DB/RLS, invariantes, E2E e build no SHA final.
- [ ] Registrar evidências e custos/latência.
- [ ] Não mergear para `main`.
- [ ] Commit.

---

## Definition of Done

O núcleo de ligação está concluído quando uma ligação real pode entrar pelo Telnyx, estabelecer sessão LiveKit, transcrever voz, identificar tenant/cliente, hidratar Customer Memory, entregar o turno ao Agent OS/agente publicado já existente, sintetizar a resposta, aceitar interrupção, usar ferramentas governadas, transferir para humano, registrar histórico/métricas e aparecer no painel desktop/mobile — sem criar agentes duplicados por canal e sem alterar a arquitetura interna dos agentes existentes.

## Relação com o plano maior

Este plano é deliberadamente estreito. Ele é o detalhamento técnico das Fases 5–7 e da parte de voz da Fase 10/13/14/15 do plano mestre:

`docs/superpowers/plans/2026-08-23-implementacao-tokens-master-plan.md`

O plano mestre continua sendo a fonte do panorama completo do CRM: Agent OS, Customer Memory, router free-first, WhatsApp, voz, ferramentas comerciais, pedidos/ETA, handoff, mídia, multiempresa, painel, evals e observabilidade.
