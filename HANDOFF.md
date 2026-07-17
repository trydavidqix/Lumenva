# HANDOFF — Webhooks Universais + Motor de Regras

> ⚠️ **INSTRUÇÃO PERMANENTE (não remover):** Este documento DEVE ser lido no
> INÍCIO de toda sessão que trabalhe nesta feature, e ATUALIZADO + COMMITADO ao
> final de CADA avanço (task concluída, decisão tomada, problema encontrado).
> Regra do Rafael: progresso só conta com PROVA VISÍVEL (output de teste, curl,
> screenshot Playwright). Nada de "implementado" sem evidência registrada aqui.
> Medidas de front-end são verificadas por ferramenta (Playwright
> getBoundingClientRect/getComputedStyle), nunca a olho.
> COMMITAR este arquivo a cada atualização — mudança só no working tree se
> perde quando um subagent limpa a árvore (já aconteceu 1x).

## Contexto fixo

- **Feature:** sistema de Webhooks (inbound de leads + mini motor de regras + outbound) — spec em `docs/superpowers/specs/2026-07-17-webhooks-design.md`.
- **Planos:** `docs/superpowers/plans/2026-07-17-webhooks-backend.md` (13 tasks) e `docs/superpowers/plans/2026-07-17-webhooks-ui.md` (6 tasks). Backend primeiro.
- **Onde:** worktree `/Users/rafaelmelgaco/DeskcommCRM/.claude/worktrees/webhooks`, branch `feat/webhooks-automation` (base origin/main). Checkout principal está no `gov/G4` com trabalho do gov-loop — NÃO tocar nele.
- **Método:** subagent-driven (1 implementer + 1 reviewer por task), ledger em `.superpowers/sdd/progress.md`. Após CADA task: prova na tela pro Rafael + atualizar+commitar este arquivo.
- **Ambiente:** `.env.local` e `.e2e-creds.json` copiados do checkout principal. Testes de invariante rodam em Postgres 17 EFÊMERO construído do `baseline.sql` (`npm run test:invariants`) — prova local real, independente do banco remoto.

## Estado atual

| Task | Status | Prova |
|---|---|---|
| BE-T1 migration 0038 + RLS | ✅ completa (review ok) | `d908636`; 54/54 invariantes PASS incl. 6 novos de RLS 2-tenants |
| BE-T2 drain genérico + retry | ✅ completa (review ok pós-fix) | `e2b487c`+`9717b65`; 63/63 PASS (9 casos drain); fixes: NULL next_attempt_at drena; retry preserva last_error; retry sem retry_at → backoff |
| BE-T3 emissões de gatilho | ✅ completa (review ok) | `f186486`; 66/66 PASS; 4 emissões conferidas pós-mutação, payloads = contrato congelado |
| BE-T4 actor webhook_source | ✅ completa (review ok) | `852ce19`; typecheck limpo, 11/11 schema tests; 17 call sites auditados e re-verificados pelo reviewer |
| BE-T5 parser inbound | ⏳ em implementação | — |
| BE-T6 a T13 | pendente | — |
| UI T1-T6 | pendente | — |

## Última atualização

- **2026-07-17 ~17h** — T1-T3 completas com review; T4 em review. Próximo passo exato: veredito T4 → despachar T5 (parser inbound, `lib/webhooks/inbound.ts`, unit puro).

## Decisões e problemas encontrados

- **Banco remoto ainda SEM a migration 0038.** Supabase cloud (`rrydmwnpo…`) recebe via MCP (OAuth pendente — link enviado ao Rafael) ou `supabase link`+push. Obrigatório ANTES da BE-T13 (curl no dev server) e da fase UI. `database.types.ts` foi escrito à mão (typecheck ok) — regenerar por máquina quando autenticar.
- **`npm run lint` quebra no worktree** (conflito de plugin eslint pré-existente, idêntico no commit base) — não é desta feature.
- **DECISÃO DE CONTRATO (T3→T8):** trigger de banco pré-existente `fn_emit_event_on_lead_change` TAMBÉM emite `lead.stage_changed` com `entity_kind='lead'` (payload pobre). O motor (T8) DEVE filtrar por entity_kind esperado (`lead.*`→`crm_lead`, `contact.*`→`contact`, `message.received`→`message`) e skip no resto — senão regra dispara 2x.
- T3 adicionou dummy Supabase env em `vitest.db.config.ts` (test.env) — teste importa handlers que puxam `lib/env`.
- Minors acumulados p/ review final estão no ledger `.superpowers/sdd/progress.md`.
- Stash stack compartilhado: conferido limpo. Regra: nunca `git stash` bare (worktrees compartilham o stack com o gov-loop).
