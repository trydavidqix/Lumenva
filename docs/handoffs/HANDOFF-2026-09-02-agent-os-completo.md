---
type: handoff
project: DeskcommCRM
date: 2026-09-02
status: fechado para continuidade em 2026-09-03
audited_against: main @ 1d8b7b2579ac0d953496b2f5ea9c33650b3af332
---

# Handoff — Agent OS completo, prospecção e memória

## Estado confirmado

`main` está em `1d8b7b2579ac0d953496b2f5ea9c33650b3af332`. O commit mais
recente é o forward-fix de baseline de `ai_agent_versions`; `origin/main` ainda
estava em `7ce0359b455ade96dbf8cbfbccbbfc4508709d1b` no momento desta auditoria,
portanto este handoff inclui o commit local mais recente e precisa de push.

O histórico real de hoje confirma a integração sequencial em `main`:

- Fase 2 — Kernel: merge `cc41dbef` (com implementação em `77ea4b54`);
- Fase 4 — SHADOW/evals: merge `64468528` (implementação em `b61240dc`);
- Fase 5 — autonomia assistida: merge `60ed322f`;
- Fase 6 — aprendizado/flywheel: merge `19a3e36d` (implementação em
  `d5e53fec`);
- Fase 7 — workflows duráveis/benchmark: merge `26507491` (artefactos em
  `645a3c41` e wiring da suite em `df3e11d8`).

A Fase 3 — agentes de produto — já estava integrada antes da janela de hoje,
com implementação e verificação históricas nos commits `19666b86`,
`b789b85d`, `c1fae5b9` e `fee44013`. Assim, as seis fases do Agent OS estão
presentes em `main`: 2, 3, 4, 5, 6 e 7. A integração foi feita uma fase por
vez em worktree isolada, com os gates de typecheck, lint e testes executados
antes de cada merge conforme o processo de integração; a prova reproduzível
de hoje é o histórico/árvore final, não uma nova execução de todos esses gates
neste checkout sujo.

## Correção real de schema

O bug de `multiple primary keys` foi encontrado no reaplicar do
`supabase/baseline.sql`: a migration 0023 já cria a chave primária inline e o
`ALTER TABLE` dump-style incondicional tentava criá-la de novo.

- `5e1d3113` tornou `ai_agent_runs_pkey` idempotente, consultando
  `pg_constraint` antes de adicionar a constraint;
- o commit mais recente, `1d8b7b25`, aplicou a mesma correção a
  `ai_agent_versions_pkey`;
- ambas as correções estão agora no baseline em `main`. Não foi feita migration
  remota nem alteração destrutiva de dados.

## Pipeline de prospecção

`scripts/lead-pipeline/` está versionado com `gosom` como scraper principal,
`agent-reach` e `last30days` para enriquecimento/contexto e ScrapeGraphAI
opcional. A execução documentada de 2026-09-02 produziu 20 leads de clínicas
dentárias em Lisboa, sem jobs falhados, com CSV, telefones, sites e links
WhatsApp quando encontrados. Uma segunda execução produziu 1 lead real em
Sion, Suíça. ScrapeGraphAI ficou explicitamente `skipped` sem chave de API;
não foi ativado por decisão consciente.

## Google Sheets

OAuth real foi concluído pelo dono e o fluxo configurado para as planilhas
`Leads` e `Clientes`, criadas e formatadas. O agente fixo `Prospector` foi
criado de forma permanente: pesquisa e preenche apenas a planilha `Leads`,
verifica duplicidade por nome + telefone e não envia mensagens nem cria novas
planilhas.

## Diário automático

O agente fixo `Memória` e a rotina Maestri diária das 21h foram criados. A
rotina escreve resumos úteis em `~/Documents/Diario-Lumenva/`. O agente não
recruta outros agentes e não apaga dados sem autorização.

## Decisão de memória

`docs/architecture/memory-architecture.md` documenta as quatro camadas,
namespace tenant-first, CRM relacional como fonte de verdade e memória
derivada reprocessável. Mem0/Graphiti/Neo4j permanecem desligados: **NO-GO
para religar na VPS** até existirem isolamento por tenant, backup restaurável,
healthchecks, retenção/redação RGPD e testes de idempotência/cross-tenant.

## Regra operacional permanente

**NUNCA usar Docker no Mac.** Docker permanece reservado aos ambientes onde a
doutrina/runbook o autoriza; esta regra não autoriza instalação, inicialização
ou download local.

## Pendências para 2026-09-03

- `codex/voice-crm-config`: feature de tom de voz nunca integrada; decisão do
  dono pendente.
- Twilio/Vodafone: bloqueado no dono por upgrade da conta.
- Aproximadamente 25 branches remotas `origin/*`: revisão em andamento por
  outro agente, registrada em `docs/audits/upstream-branches-review-2026-09-02-v2.md`.
- ScrapeGraphAI: sem chave de API configurada; manter desativado até decisão
  explícita.

## Estado do checkout e gates

Antes deste handoff já existiam alterações alheias não relacionadas (site,
exportador de Sheets, `.maestri/` e artefactos locais de prospecção); foram
preservadas e não entram neste documento. Este handoff é a única alteração
intencional desta tarefa.

Após escrever o arquivo, executar `pnpm harness:check` e registrar o resultado
no fechamento. Não executar migrations remotas, deploy, instalação de pacotes,
login OAuth ou ações no navegador.
