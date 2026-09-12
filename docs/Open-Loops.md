---
type: open-loops
project: Lumenva
last_updated: 2026-09-12
audited_against: f1/baseline-pnpm-2026-09-09 @ e020cd6f4f4a8958e8e30ab9ab29e53494565f9c
---

# Open loops - baseline F1

- Format baseline: format=1686 ficheiros falham prettier check no baseline e020cd6f; propor chore(format) repo-wide como PR isolado antes de F8.
- Harness baseline: harness=17 findings; agendar task de governanca, nao F1. Paths DeskcommCRM e CLAUDE.md alimentam task Batismo.
  - .claude/rules/git-workflow.md: missing-rule
  - .claude/rules/security.md: missing-rule
  - .claude/rules/multi-tenancy.md: missing-rule
  - .claude/rules/api-contract.md: missing-rule
  - .claude/rules/audit-observability.md: missing-rule
  - .claude/rules/lgpd.md: missing-rule
  - .claude/rules/whatsapp-waha.md: missing-rule
  - .claude/rules/data-modeling.md: missing-rule
  - .claude/rules/database-migrations.md: missing-rule
  - .claude/rules/testing-verification.md: missing-rule
  - .claude/rules/documentation.md: missing-rule
  - .claude/rules/graphify.md: missing-rule
  - .claude/rules/skill-routing.md: missing-rule
  - .gitignore: rules-not-versionable
  - CLAUDE.md: missing-doctrine
  - .claude/skills/DeskcommCRM/SKILL.md: missing-repo-skill
  - .agents/skills/DeskcommCRM/SKILL.md: missing-repo-skill

Estes loops nao estao resolvidos. Cada encerramento exige prova reproduzivel, exit code, SHA e revisao.

## F2-DB-CHAIN-002 — squash canónico de migrations

- Estado confirmado: a cadeia histórica é incoerente. supabase/baseline.sql e as migrations até ao cutoff 160 divergem; a migration 0014_storage_policies_ai_policy tenta recriar a policy tenant_read_ai_policy que já existe no baseline.
- O caminho db:migrate a partir de uma base vazia não fecha EXIT=0 sem reconciliar esse histórico redundante.
- O runner usa o baseline como base canónica (00000_baseline), regista sem executar as migrations contidas até BASELINE_APPLIED_THROUGH = 160 e executa apenas deltas posteriores.
- Prova disponível: o baseline criou public.contacts; o runner avançou até à primeira migration fora do conjunto consolidado, onde a divergência de trigger foi observada.
- Open-loop futuro — PRECISA DONO=sim: reconciliar o schema canónico CRM, escolhendo baseline de produção ou remoção formal das migrations redundantes. Estimativa: 90–180 min. Não executar nesta tarefa.
- Spot-check pendente: reconciliar explicitamente a policy storage.objects.tenant_read_ai_policy da migration 0014 com a definição já presente no baseline.

## Etapa 3 — Stripe (EM ANDAMENTO)

- Produtos e preços Stripe criados; falta concluir a integração operacional ponta a ponta.
- Fechar webhook Stripe assinado, validação de assinatura, idempotência e atualização server-side de `organization_plan`/entitlements.
- Confirmar que nenhum frontend, API auxiliar, MCP, CLI, worker ou agente concede acesso por estado de pagamento não confirmado pelo webhook.
- Executar testes de catálogo, webhook, replay/idempotência, tenant isolation, transições de pagamento e regressão.
- Produção e primeiro cliente permanecem `NOT_PROVEN` até haver probe externo reproduzível e fluxo completo contratado → pago → módulo autorizado.

## Ordem de prioridade viva

1. Fechar Etapa 3 Stripe.
2. Validar primeiro cliente ponta a ponta.
3. Só depois retomar as waves secundárias do Business OS.

Cada atualização futura deve substituir o estado deste bloco com data, evidência, SHA/checkout e próximo loop; não apagar o histórico de decisões nem declarar produção por teste local.
