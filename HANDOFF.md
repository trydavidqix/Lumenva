# HANDOFF — Webhooks Universais + Motor de Regras

> ⚠️ **INSTRUÇÃO PERMANENTE (não remover):** Este documento DEVE ser lido no
> INÍCIO de toda sessão que trabalhe nesta feature, e ATUALIZADO ao final de
> CADA avanço (task concluída, decisão tomada, problema encontrado). Regra do
> Rafael: progresso só conta com PROVA VISÍVEL (output de teste, curl,
> screenshot Playwright). Nada de "implementado" sem evidência registrada aqui.
> Medidas de front-end são verificadas por ferramenta (Playwright
> getBoundingClientRect/getComputedStyle), nunca a olho.

## Contexto fixo

- **Feature:** sistema de Webhooks (inbound de leads + mini motor de regras + outbound) — spec em `docs/superpowers/specs/2026-07-17-webhooks-design.md`.
- **Planos:** `docs/superpowers/plans/2026-07-17-webhooks-backend.md` (13 tasks) e `docs/superpowers/plans/2026-07-17-webhooks-ui.md` (6 tasks). Executar backend primeiro.
- **Onde:** worktree `/Users/rafaelmelgaco/DeskcommCRM/.claude/worktrees/webhooks`, branch `feat/webhooks-automation` (base origin/main). O checkout principal está no `gov/G4` com trabalho do gov-loop — NÃO tocar nele.
- **Método:** subagent-driven (1 implementer + 1 reviewer por task), ledger em `.superpowers/sdd/progress.md`. Após CADA task: prova na tela pro Rafael + atualizar este arquivo.
- **Ambiente:** `.env.local` e `.e2e-creds.json` copiados do checkout principal. Migrations aplicadas via MCP Supabase no banco de dev compartilhado (aditivas — não conflitam com gov-loop).

## Estado atual

| Task | Status | Prova |
|---|---|---|
| Backend T1 — migration 0038 + RLS | 🔜 próxima | — |
| Backend T2-T13 | pendente | — |
| UI T1-T6 | pendente | — |

## Última atualização

- **2026-07-17 ~15h** — Worktree criado, branch `feat/webhooks-automation`, spec+planos cherry-picked (commits `0c3c21b`, `a7f5f29`), envs copiados, `npm install` rodando. Próximo passo exato: despachar implementer da Backend Task 1 (migration 0038) com `scripts/task-brief`.

## Decisões e problemas encontrados

- (nenhum ainda)
