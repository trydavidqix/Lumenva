# DOCUMENTATION_INTAKE — Phase 0

- Branch/worktree: business-os/phase-0-audit / /home/claude/src/worktrees/business-os-phase-0-audit-2026-09-11
- Checkout: /home/claude/src/Lumenva
- SHA: e45bdc4f1b18c063473e9bccdafd0d056329037a
- Data: 2026-09-11
- Precedência: CLAUDE.md > .claude/rules/ > docs/specs/ > docs/prd/ > handoffs/README, conforme docs/index.md:18-21.

## Fontes lidas

- CLAUDE.md:1-17, :29-41, :71-118; AGENTS.md:7-16, :47-86, :102-119.
- Todas as rules de .claude/rules/: api-contract, audit-observability, data-modeling, database-migrations, documentation, git-workflow, lgpd, multi-tenancy, security, testing-verification, skill-routing e whatsapp-waha.
- docs/index.md:11-21, :25-36, :63-85, :87-95.
- docs/current-state.md; docs/harness-audit.md:1-29, :33-58, :62-87; docs/threat-model.md:1-23, :27-49, :53-112.
- docs/ai/README.md, ARCHITECTURE.md, PROJECT_CONTEXT.md, AI_PROJECT_STATE.md.
- docs/runbooks/agent-harness.md e flag-activation-checklist-2026-09-05.md.
- docs/architecture/README.md, memory-architecture.md e agent-turn.html.
- docs/specs/01, 05, 06, 07, 10 e 11; docs/prd/06-prd-nuvemshop-lgpd.md; docs/business-rules/00-business-rules-catalog.md.
- docs/adr/*, docs/handoffs/* e docs/audits/* como fontes secundárias.

## Blueprint / Phase 0 / seção 17

~/master-blueprint-IMPLEMENTAVEL.md foi lido no topo e nas partes relevantes: topo (MODEL ≠ AGENT, Agent Birth, CRM/control plane, Postgres source of truth, determinismo, evidência, autonomia); PHASE 0 nas linhas 613-621; regra de documentos e nenhum package estrutural nas linhas 7440-7480; Wave/section 17 nas linhas 9558-9588.

A section 17 mapeia Waves 6–10 (Studio/Delivery). Ela é target e não evidência de implementação atual.

## Fontes oficiais e limites

O blueprint exige documentação oficial OpenAI (Agents, orchestration, tools, sessions, context, handoffs, guardrails, tracing), Anthropic (model, prompting, tool use, workflows, context/compaction, system-prompt publications) e providers/runtime. Essas páginas não estão congeladas no checkout: ficam PENDING_EXTERNAL_READ/NOT_IN_CHECKOUT. Nenhum provider live, sandbox, credencial, deploy ou instância externa foi usado.

## Conflitos reconciliados

1. Contagens/data de docs/index.md e audits históricos são snapshots; código no SHA auditado é a autoridade factual.
2. docs/harness-audit.md:20-29 torna incorreta qualquer alegação de CI GitHub executado.
3. Blueprint packages versus implementação em apps/crm/lib foram classificados PARTIAL, não promovidos a EXISTS.
4. Section 17 descreve Waves 6–10, não estado atual.
5. current-state, handoffs e audits têm audited_against histórico e não substituem leitura do SHA local.

## Exit gate

Os três ficheiros existem em docs/architecture/, citam caminhos/linhas reais, não criam código estrutural nem migrations, e preservam EXISTS/PARTIAL/MISSING/UNKNOWN sem inventar prova externa.
