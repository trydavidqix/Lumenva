# Codex — AI Platform Implementation Entry Point

> Branch exclusiva: `gpt-ai-platform`
> Base inicial: `main@4fa4ca9a7042b88d6de35e411e4375213fb26d93`
> Estado deste documento: instrução de execução. Não é prova de que as fases foram implementadas.

## Missão

Evoluir o DeskcommCRM com Mem0, LangSmith, Obsidian, LlamaIndex, Graphiti, FalkorDB, Guardrails externos opcionais, n8n, LangGraph, Infisical e KeePassXC **sem substituir o core existente**.

A arquitetura é incremental. PostgreSQL/Supabase continua sendo a fonte de verdade. `org_memory`, `lead_notes`, checkpoints, `event_log`, `job_queue`, RAG/pgvector, guardrails nativos, WAHA e o agent-engine existentes continuam válidos.

## Ordem obrigatória

1. Gate 0 — restaurar baseline verde e capturar métricas atuais.
2. Fase 0 — contratos, flags, projection ledger, secrets e Golden Dataset.
3. Fase 1 — LangSmith + redaction + avaliações.
4. Fase 2 — Mem0 em shadow, depois canary, depois active.
5. Fase 3 — Obsidian + knowledge publishing + LlamaIndex somente como adapter opcional.
6. Fase 4 — Graphiti + FalkorDB em shadow, depois canary.
7. Fase 5 — guardrails externos somente para gaps medidos.
8. Fase 6 — n8n reutilizando `event_log`, automation engine e webhooks existentes.
9. Fase 7 — LangGraph em um único workflow complexo com HITL.

Não pule fases. Não habilite uma fase para clientes enquanto o gate da fase anterior não estiver verde.

## Documentos obrigatórios

Leia nesta ordem antes de editar código:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `ARCHITECTURE.md`
4. `docs/current-state.md`
5. `docs/threat-model.md`
6. `docs/superpowers/specs/2026-08-10-ai-platform-master-design.md`
7. `docs/superpowers/specs/2026-08-10-ai-platform-qa-release-gates.md`
8. `docs/superpowers/plans/2026-08-10-ai-platform-execution-index.md`
9. O plano exato da fase em `docs/superpowers/plans/2026-08-10-ai-platform-phase-*.md`
10. `docs/handoffs/HANDOFF-ai-platform.md` para estado, limites e primeiro bloqueio conhecido.

## Planos exatos

```text
docs/superpowers/plans/
├── 2026-08-10-ai-platform-execution-index.md
├── 2026-08-10-ai-platform-phase-0-foundation.md
├── 2026-08-10-ai-platform-phase-1-observability.md
├── 2026-08-10-ai-platform-phase-2-mem0.md
├── 2026-08-10-ai-platform-phase-3-knowledge.md
├── 2026-08-10-ai-platform-phase-4-graphiti.md
├── 2026-08-10-ai-platform-phase-5-guardrails.md
├── 2026-08-10-ai-platform-phase-6-n8n.md
└── 2026-08-10-ai-platform-phase-7-langgraph.md
```

## Regras não negociáveis

### Git

- Trabalhe somente em `gpt-ai-platform` ou em uma branch filha criada a partir dela.
- Nunca faça commit direto em `main`.
- Nunca faça merge para `main` automaticamente.
- Faça commits pequenos por task, depois de teste vermelho→verde quando aplicável.
- Antes de cada commit: `git status`, `git diff --check`, testes da task e `pnpm gov:verify` quando cabível.

### Banco

- Nunca edite migration já aplicada.
- Toda mudança de schema exige simultaneamente:
  1. migration nova;
  2. apêndice idempotente em `supabase/baseline.sql`;
  3. entrada em `supabase/migrations/MANIFEST.md`;
  4. `pnpm test:db` verde.
- Toda tabela tenant-aware tem `organization_id NOT NULL`, FK para `organizations`, RLS e invariant cross-tenant.
- `service_role` nunca recebe `organization_id` vindo livremente do body/model/tool.

### Fonte de verdade

- PostgreSQL/Supabase = fonte de verdade.
- Mem0 = projeção semântica derivada e reconstruível.
- Graphiti/FalkorDB = projeção relacional/temporal derivada e reconstruível.
- LangSmith = telemetria/eval; nunca estado de negócio.
- n8n = integração; nunca banco, fila crítica ou cérebro do agente.
- LangGraph = workflow complexo; nunca fila principal, banco principal ou memória principal.
- LlamaIndex = adapter opcional de ingestão/retrieval; não substitui RAG/pgvector atual.

### Segurança e privacidade

- Nunca persistir password, API key, bearer, cookie, session token, recovery code ou segredo em Mem0, Graphiti, pgvector, Obsidian ou LangSmith.
- Sanitização acontece **antes** de qualquer envio a serviço derivado/telemetria.
- Toda consulta externa derivada é escopada por `organization_id` resolvido pelo CRM.
- Memória `HIGH` nunca autoriza ação sensível sozinha.
- STOP/LGPD/WhatsApp window/anti-ban/promises/handoff/disclosure continuam sob guardrails determinísticos do CRM.
- Nenhum serviço novo fica público por padrão; sidecars ficam na rede interna do compose.

### Custos

- Não crie, assine ou habilite recurso pago sem aprovação humana explícita.
- Se uma integração exigir cartão, upgrade ou plano pago, pare a task, registre o bloqueio e siga para tasks independentes.
- Preferência de desenho: free/open-source/self-host quando operacionalmente razoável.

### Rollout

Features externas usam um destes modos:

`OFF -> SHADOW -> CANARY -> ON`

- `SHADOW`: pode escrever/consultar para comparação, mas não influencia resposta/ação do agente.
- `CANARY`: influencia somente organizações explicitamente habilitadas.
- `ON`: disponível conforme configuração por tenant.
- Toda integração tem kill switch global.

### Falhas

- Mem0 down: agente continua com contexto nativo.
- Graphiti/FalkorDB down: agente continua.
- LangSmith down: agente continua sem tracing externo.
- LlamaIndex down: RAG nativo continua.
- n8n down: delivery fica para retry; estado do CRM não volta atrás.
- guardrail externo down: guardrails determinísticos continuam.
- PostgreSQL indisponível: fail closed para operações que dependem de estado oficial; nunca inventar estado.

## Definition of Done de cada task

Uma task só fecha quando:

1. teste de regressão/falha existe quando aplicável;
2. teste falhou antes da implementação quando TDD é aplicável;
3. implementação mínima passa;
4. typecheck/lint relevantes passam;
5. testes de tenant/RLS passam se houve schema/service-role;
6. nenhuma PII/secret aparece em log/fixture/evidência;
7. documentação afetada está sincronizada;
8. `git diff --check` está limpo;
9. commit contém somente o escopo da task.

## Proibições explícitas

- Não reescrever o agent-engine inteiro.
- Não substituir `event_log` por n8n ou LangGraph.
- Não substituir `lead_notes`/`org_memory` por Mem0.
- Não usar Graphiti como fonte oficial de contrato, consentimento, status ou pagamento.
- Não deixar o modelo escolher `organization_id`.
- Não enviar payload bruto de conversa para LangSmith.
- Não introduzir dependência obrigatória de Python no hot path da mensagem; Graphiti/LlamaIndex/Guardrails Python ficam atrás de adapters/sidecars e são opcionais.
- Não ativar Mem0/Graphiti diretamente em produção sem shadow + avaliação + canary.
- Não usar `ts-ignore`, `any`, retry infinito ou catch silencioso para fazer gate passar.
- Não mascarar baseline vermelho removendo teste.

## Saída esperada do Codex

Ao concluir cada fase, produzir no próprio branch:

- lista de tasks concluídas;
- commits da fase;
- comandos de verificação executados e resultados;
- métricas antes/depois;
- riscos residuais;
- itens que exigem ação humana;
- decisão explícita `GO` ou `NO-GO` para a fase seguinte, baseada nos gates do QA.

Se qualquer gate P0 falhar, a resposta obrigatória é `NO-GO`; não avance por conveniência.
