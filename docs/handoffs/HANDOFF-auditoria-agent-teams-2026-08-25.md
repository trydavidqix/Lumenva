# HANDOFF — Auditoria de pendências via agent teams (2026-08-25)

> Sessão fechada. Registro histórico de uma auditoria pontual, não um épico com waves.

## O que o dono pediu

Depois de uma sequência de verificações "não tem nada pendente?" nesta sessão, o dono pediu
pra usar a feature experimental **agent teams** do Claude Code (ligada nesta mesma sessão via
`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` em `~/.claude/settings.json`) pra investigar em
paralelo as 6 pendências que `docs/current-state.md` §3/§6 registrava como incertas
("A CONFIRMAR"). Instrução literal: investigar primeiro, não commitar nada sem aprovação
explícita por item.

As 6 frentes, uma por teammate:

1. Harness Evolution — prova de WhatsApp real que faltava
2. Casos Humanos Wave 7 — E2E relatado PARCIAL
3. Inbox Multimodal ondas 4-6 — estado incerto
4. Fase FG/Vendaval — não estava mais no roadmap, mas gatilho existia
5. Operação Visível — features só provadas em localhost, faltava VPS
6. Bug de layout mobile a 390px — achado antigo nunca endereçado

## O que cada investigação achou

| # | Investigação | Resultado |
|---|---|---|
| 1 | Harness Evolution | **Doc desatualizado, não pendência real.** Prova já tinha acontecido em 2026-07-27 (`evidence/f4-prova-real-whatsapp.png`); o próprio HANDOFF documentava o fechamento mais embaixo, mas o cabeçalho nunca foi atualizado. |
| 2 | Casos Humanos Wave 7 | **Doc desatualizado.** Épico fechou e está em `main`, mantido ativamente (`ddff0978`, o mesmo bug do `agent_cases` órfão corrigido nesta sessão — ver abaixo). Dívida real, não de produto: `tests/e2e/human-cases.spec.ts` planejado nunca foi escrito. |
| 3 | Inbox Multimodal ondas 4-6 | **Doc desatualizado.** "Onda 6" nunca existiu — invenção do resumo em `current-state.md`. Ondas 4/5(+subondas) confirmadas em `main` via PR mergeados, código+migration+teste+rota-na-nav. Único ponto real: credencial Anthropic/Google é dado de runtime no banco, não verificável por leitura de código. |
| 4 | Fase FG/Vendaval | **Doc desatualizado, achado grande.** A fusão já estava em `main` há mais de 1 mês (3 merges, 221 commits em `lib/agent-engine/`, atividade até 3 dias antes desta auditoria). Não saiu de escopo — virou trabalho corrente. Arquivados `docs/vendaval-fusion-plan.md` e `docs/vendaval-vps-deploy-comandos.md` em `docs/archive/`. |
| 5 | Operação Visível | **Achado real, corrigido em 2 rodadas.** O HANDOFF alegava "4/4 provado em paridade VPS" contra um servidor que **não é produção** (`129.121.45.100:18080`). Refeito contra `crm.lumenva.pt` real: F1 passou de cara; F3 (aba "Propostas" sumindo) investigado e fechado como comportamento esperado (propostas são org-scoped, o tenant de teste não tinha nenhuma); F2(i)/F2(ii) exigiram seedar dado de teste (`scripts/seed-e2e-operacao-visivel.ts`, novo, isolado no tenant `e2e-test-org`) — provados depois, 4/4 fechado. |
| 6 | Bug mobile 390px | **Bug real, corrigido.** Sidebar fixo de 240px sem breakpoint responsivo. Causa exata achada (`components/shell/Sidebar.tsx:38`, `app/app/_components/AppShell.tsx:28`), fix mínimo aplicado (colapsa em ícone abaixo de `md`), testado ao vivo (462px de overflow → 0). |

## O que foi corrigido/mudado de fato

**Bug de produto (1):**
- Sidebar sem breakpoint mobile — fix aplicado e deployado.

**Achado lateral, registrado sem corrigir:**
- `/app/connections` exige role `admin`; `manager` bate 403. Pode ser RBAC intencional — não investigado a fundo, fica pra decisão do dono se aparecer de novo.

**Documentação reconciliada (6 arquivos, na fonte, não só no resumo):**
- `HANDOFF-harness-evolution.md` — prova WhatsApp fechada
- `docs/handoffs/HANDOFF-casos-humanos.md` — Wave 7 fechada
- `HANDOFF-operacao-visivel.md` — banner corrigindo a VPS errada + as 2 rodadas de prova real
- `docs/current-state.md` — as 6 linhas do §3 reconciliadas, §6 com 2 perguntas respondidas
- `docs/index.md` — referência aos planos Vendaval atualizada pro novo path

**Infraestrutura de teste nova:**
- `scripts/seed-e2e-operacao-visivel.ts` — idempotente, mesmo padrão de `scripts/seed-e2e-credentials.ts`, filtra sempre por `organization_id = e2e-test-org`, nunca toca o tenant Lumenva real.

## Commits desta sessão (ordem cronológica)

1. `9d597df3` — fix(shell): força sidebar em modo ícone abaixo de 768px
2. `c1ec7a0e` — docs: reconcilia 4 achados de auditoria desatualizados
3. `0ef32399` — docs: fecha F3 (aba Propostas) como comportamento esperado
4. `7ff4e873` — docs: corrige na fonte os 2 HANDOFFs por trás da reconciliação
5. `070256cc` — docs+test: F2(i)/F2(ii) provados na VPS real, épico fecha 4/4

Todos pushados pra `origin/main` e sincronizados na VPS (`crm.lumenva.pt`, `root@2.29.8.225`)
via `git pull` — só o commit 1 (código) exigiu rebuild+redeploy do container `app`, os demais
são docs/script sem efeito em runtime.

## Nota fora do escopo desta auditoria

Durante a sincronização final, um commit de **outra sessão do dono** (`c8ef4858`,
`fix(rag): stop marking conversations knowledge source as failed`, toca
`workers/rag-indexer.ts`) chegou no `origin/main` e foi puxado pro checkout da VPS junto. Esse
fix **não foi rebuildado/redeployado** — o container `worker` na VPS segue com a imagem de
2026-08-22, sem esse fix rodando de verdade. Não fiz o rebuild porque não fazia parte do que o
dono pediu nesta sessão; fica registrado pra não ficar invisível.

## Estado final

- `main` local = `origin/main` = VPS, todos em `070256cc`.
- `pnpm harness:check` limpo.
- Nenhuma pendência desta sessão ficou sem documentar ou sem commitar.
- Pendência de fora desta sessão, não resolvida: rebuild do `worker` pra aplicar `c8ef4858`.
