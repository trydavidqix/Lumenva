---
type: handoff
project: DeskcommCRM
status: pending
created: 2026-08-29
audited_against: codex/crm-consolidated @ 6f6232a2 (local, não enviado a origin)
---

# HANDOFF — rodar `pnpm test:unit` completo pós-merge de voz (ambiente cloud)

## Por que este handoff existe

`codex/voice-media-integration` (276 commits, 234 arquivos) foi mergeada localmente em
`codex/crm-consolidated` (commit `6f6232a2`, `git merge --no-ff`, sem conflitos). `pnpm typecheck`
e `pnpm lint` (escopados aos arquivos tocados pela merge) já passam limpos. Falta confirmar
`pnpm test:unit` da suíte inteira — múltiplas tentativas no Mac local (direto e via subagentes
"remote", que na verdade rodam em worktrees locais na mesma máquina, não em hardware separado)
esbarraram em contenção de recursos (load average do sistema chegou a 320+, um worktree teve
`node_modules` corrompido por acesso `pnpm` concorrente). Decisão: rodar num ambiente cloud
genuinamente separado.

## O que pedir ao Codex

Peça exatamente isto:

> No branch `codex/crm-consolidated` (HEAD atual `6f6232a2`), rode `pnpm install` e depois
> `pnpm test:unit` até o comando terminar sozinho (não interrompa antes do fim). Reporte o resumo
> final do vitest: quantos arquivos/testes passaram, falharam e pularam. Para qualquer teste que
> falhou, cole o nome do teste e a mensagem de erro/assert. Não corrija nada, não faça commit — só
> rode e reporte o resultado real.

## O que já se sabe (não precisa redescobrir)

Uma execução parcial local (interrompida no meio, não é resultado final da suíte) já mostrou estas
falhas — o Codex deve confirmar se persistem na suíte completa, não as tratar como surpresa:

- `tests/unit/manifest-x-migrations.test.ts` — 2 falhas: "toda migration tem linha no MANIFEST" e
  "nenhum número de migration é usado duas vezes". Causa provável já identificada:
  `supabase/baseline.sql` não tem o apêndice idempotente para as migrations de voz (`voice_calls`,
  `voice_phone_numbers`, `voice_sip_connections`) trazidas pela merge — viola a "regra da tripla"
  de `CLAUDE.md` (migration + baseline + MANIFEST juntos). **Ainda não corrigido.**
- `tests/unit/navegacao-completude.test.ts` — 1 falha: "toda tela tem porta: está no registro ou
  na allowlist justificada". Sugere uma tela nova de voice sem entrada em
  `lib/navigation/registry.ts`. **Ainda não corrigido.**
- `tests/unit/mcp-escalacao-tools.test.ts` — 1 falha vista de relance ("cada handler tem a
  declaração correspondente no catálogo"), sem mensagem de erro capturada ainda (uma das tentativas
  crashou por corrupção de `node_modules` antes de imprimir o detalhe). Precisa confirmação.

## O que fazer com o resultado

1. Se as 3 falhas acima forem as únicas e baterem com a causa já suspeitada, o próximo passo (fora
   deste handoff) é corrigir `supabase/baseline.sql` + `MANIFEST.md` para as migrations de voz, e
   registrar a tela faltante em `lib/navigation/registry.ts` (ou justificar allowlist).
2. Se aparecerem falhas novas e inesperadas, reporte a lista completa antes de qualquer correção —
   não tente adivinhar causa sem ver a mensagem de erro real.
3. Não faça push para `origin` — a branch local está 278 commits à frente e push exige autorização
   explícita separada, não incluída neste handoff.

## Contexto adicional se precisar

- `docs/current-state.md` §11 tem o estado completo da integração de voz.
- `CHANGELOG.md` (seção "Não lançado") tem o resumo da merge e das 3 correções pós-merge já
  aplicadas (typecheck, eslint, `vitest.config.ts`).
