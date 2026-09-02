---
type: index
project: DeskcommCRM
status: maintained
last_updated: 2026-08-28
generated_by: auditoria documental sincronizada — CRM consolidado e Voice Core
confidence: alta (inventário de arquivos é CONFIRMADO; agrupamento temático é INFERIDO)
audited_against: codex/crm-consolidated @ 54e86839 (sincronização documental de voz; inventário recontado em 2026-08-28)
---

# Índice da documentação — DeskcommCRM

Mapa da documentação versionada de `docs/` — a árvore auditada contém 214 `.md`/`.mdx`.
Confirme a contagem com `rg --files docs -g '*.md' -g '*.mdx' | wc -l`. Existe porque a documentação cresceu sem ponto
de entrada: sem este índice, humano e agente não acham o que já foi decidido e
reescrevem por cima.

**Regra de precedência quando dois docs discordam:**
`CLAUDE.md` (doutrina) > `docs/specs/` (contrato técnico) > `docs/prd/` (intenção) >
`HANDOFF-*.md` (estado de sessão) > README. Se achou divergência, corrija a fonte
de menor precedência e registre.

---

## 1. Comece por aqui

| Doc | Para quê |
|---|---|
| [`README.md`](../README.md) | O que é, quickstart de 5 min, stack, roadmap. Também em [EN](../README.en.md) / [ES](../README.es.md) |
| [`VISION.md`](../VISION.md) | Posicionamento, por que self-host, para quem |
| [`ARCHITECTURE.md`](../ARCHITECTURE.md) | Arquitetura em 1 página |
| [`AGENTS.md`](../AGENTS.md) | Contrato para agentes de código (qualquer ferramenta) |
| [`CLAUDE.md`](../CLAUDE.md) | **Doutrina não-negociável.** Convenções, anti-patterns, Definition of Done |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Como contribuir |
| [`CHANGELOG.md`](../CHANGELOG.md) | Mudanças por versão (SemVer). **Quem roda VPS lê antes de `update.sh`** — mudança que exige ação manual aparece sob "⚠️ Requer atenção" |
| [`docs/current-state.md`](current-state.md) | **O que está pronto, incompleto e quebrado hoje** |

### Voz

| Doc | Conteúdo |
|---|---|
| [`voice/open-source-europe.md`](voice/open-source-europe.md) | Decisão SIP/BYOC, stack open-source europeia e estado real da integração |
| [`handoffs/HANDOFF-voice-sip-2026-08-28.md`](handoffs/HANDOFF-voice-sip-2026-08-28.md) | Estado sincronizado, alterações, provas, bloqueios e próximos passos do Voice Core |
| [`handoffs/HANDOFF-voice-vps-config-2026-08-28.md`](handoffs/HANDOFF-voice-vps-config-2026-08-28.md) | Resultado da leitura da VPS e estado do benchmark cloud de áudio |
| [`evidence/voice-vps-config-2026-08-28/README.md`](evidence/voice-vps-config-2026-08-28/README.md) | Índice da evidência de configuração da VPS; sem credenciais e sem prova de chamada completa |
| [`evidence/voice-vps-real-call-bridge-2026-08-28.md`](evidence/voice-vps-real-call-bridge-2026-08-28.md) | **Primeira chamada real de ponta a ponta** (script ad-hoc, prova de conceito) — 6 bugs de RTP corrigidos, pendências reais e achado de segurança do Asterisk exposto |
| [`../ops/voice-asterisk/README.md`](../ops/voice-asterisk/README.md) | Config real do Asterisk extraída e versionada (segredos redigidos) |

## 2. Produto e intenção

| Doc | Conteúdo |
|---|---|
| [`prd/00-prd-master.md`](prd/00-prd-master.md) | PRD mestre — visão, escopo MVP, KPIs, restrições |
| [`prd/01-prd-platform-base.md`](prd/01-prd-platform-base.md) | Auth, tenancy, RBAC, framework LGPD |
| [`prd/02-prd-customer-360.md`](prd/02-prd-customer-360.md) | Customer 360 + identity resolution determinística |
| [`prd/03-prd-whatsapp-waha.md`](prd/03-prd-whatsapp-waha.md) | Canal WhatsApp, anti-banimento, janela 24h |
| [`prd/04-prd-pipeline-attendance.md`](prd/04-prd-pipeline-attendance.md) | Kanban, atendimento, tickets, handoff |
| [`prd/05-prd-ai-rag-handoff.md`](prd/05-prd-ai-rag-handoff.md) | IA conversacional, RAG por tenant, sentiment |
| [`prd/06-prd-nuvemshop-lgpd.md`](prd/06-prd-nuvemshop-lgpd.md) | Integração Nuvemshop + webhooks LGPD |
| [`business-rules/00-business-rules-catalog.md`](business-rules/00-business-rules-catalog.md) | **Catálogo de regras de negócio** — fonte da verdade fora do código |
| [`presentation/pitch-deck.md`](presentation/pitch-deck.md) | Pitch |

## 3. Contrato técnico (specs)

Detalham schema SQL e payloads exatos. **Consulte antes de modelar qualquer coisa.**

| Spec | Domínio |
|---|---|
| [`specs/01`](specs/01-spec-platform-base.md) | Plataforma base — tenancy, RLS, RBAC, API, audit |
| [`specs/02`](specs/02-spec-customer-360.md) | Customer 360 |
| [`specs/03`](specs/03-spec-whatsapp-waha.md) | WAHA — fila outbound, warm-up, spinning, crons |
| [`specs/04`](specs/04-spec-pipeline-attendance.md) | Pipeline e atendimento |
| [`specs/05`](specs/05-spec-ai-rag-handoff.md) | IA, RAG, gatilhos de handoff |
| [`specs/06`](specs/06-spec-nuvemshop-lgpd.md) | Nuvemshop + LGPD |
| [`specs/07`](specs/07-spec-events-workers.md) | **`event_log`, workers, claim atômico, backoff/DLQ** |
| [`specs/08`](specs/08-spec-deploy-observability.md) | Deploy e observabilidade |
| [`specs/09`](specs/09-spec-frontend-backend-integration.md) | Integração front/back |
| [`specs/10`](specs/10-spec-ai-agents-runtime.md) | Runtime dos AI Agents |
| [`specs/11`](specs/11-spec-mcp-server-internal.md) | MCP server interno + catálogo de tools |
| [`specs/12`](specs/12-spec-ai-agents-ui.md) | UI dos AI Agents |
| [`specs/13`](specs/13-spec-governanca-atendimento.md) | Governança de atendimento (épico G1–G6) |
| [`specs/14`](specs/14-contrato-governanca-agentes-externos.md) | Contrato para agentes de IA externos |
| [`specs/15`](specs/15-spec-casos-humanos.md) | Casos humanos (IA delega a humano) |
| [`specs/16`](specs/16-spec-tres-papeis-do-agente.md) | **Três papéis do agente** — Conversador / Operador / Segurança |
| [`specs/RECONCILIATION-LOG.md`](specs/RECONCILIATION-LOG.md) | Log de reconciliação entre specs |

## 4. Doutrina e arquitetura

| Doc | Conteúdo |
|---|---|
| [`doctrine/sistema-vivo.md`](doctrine/sistema-vivo.md) | **Doutrina do Sistema Vivo** — 5 invariantes + Living System Checklist (item 13 do DoD) |
| [`architecture/agent-turn.html`](architecture/agent-turn.html) | Diagrama do turno do agente (inbound → guardrails → outbound) |
| [`architecture/memory-architecture.md`](architecture/memory-architecture.md) | Arquitetura de memória em quatro camadas, namespaces e plano de adoção |
| [`research/architecture-diagrams.md`](research/architecture-diagrams.md) | Diagramas de arquitetura |
| [`research/reference-synthesis.md`](research/reference-synthesis.md) | Arquitetura herdada da referência WAHA |
| [`research/followup-reference-mining.md`](research/followup-reference-mining.md) | Pesquisa do motor de follow-up |
| [`pesquisa/google-sheets-integracao-2026-09-02.md`](pesquisa/google-sheets-integracao-2026-09-02.md) | Inventário e preparação da integração Google Sheets |
| [`guides/lead-pipeline.md`](guides/lead-pipeline.md) | Pipeline permanente de leads e exportação Google Sheets |
| [`threat-model.md`](threat-model.md) | **Superfície de ataque real do self-host** |

## 5. Design system

[`design-system/README.md`](design-system/README.md) é o ponto de entrada (v1.0, 5 escolhas
visuais lockadas: paleta Sage, Atkinson Hyperlegible, densidade aerada, Phosphor duotone,
IBM Plex Mono). Numerados `00`–`09`: overview, tokens, paleta, tipografia, densidade,
iconografia, componentes, motion, voice & tone, **anti-patterns**.
Fluxo de tela em `design-system/screen-flow/` (jornadas, clickflows, máquinas de estado,
acessibilidade).

## 6. Operar e instalar

| Doc | Conteúdo |
|---|---|
| [`SETUP.md`](SETUP.md) | Guia completo de env vars e setup local |
| [`deploy-selfhost/README.md`](deploy-selfhost/README.md) | Self-host genérico |
| [`deploy-hostgator/README.md`](deploy-hostgator/README.md) | VPS HostGator (`install.sh`, `backup.sh`, `reset-mfa.sh`) |
| [`DEPLOY-CHECKLIST.md`](DEPLOY-CHECKLIST.md) | Checklist de deploy |
| [`ATUALIZANDO.md`](ATUALIZANDO.md) | `update.sh`, `restore.sh`, `healthcheck.sh` |
| [`runbooks/deploy.md`](runbooks/deploy.md) | **Deploy em produção — os dois `-f` do compose, verificação pós-deploy** |
| [`runbooks/waha-hostgator.md`](runbooks/waha-hostgator.md) | Runbook do WAHA em produção |
| [`runbooks/ai-credentials-rotation.md`](runbooks/ai-credentials-rotation.md) | Rotação de credenciais de IA |
| [`runbooks/lumenva-website.md`](runbooks/lumenva-website.md) | Site institucional Lumenva na Vercel, domínio, formulário e e-mail |
| [`../SECURITY.md`](../SECURITY.md) | Política de reporte de vulnerabilidade |

## 7. Testes e QA

| Doc | Conteúdo |
|---|---|
| [`testing/user-journey-map.md`](testing/user-journey-map.md) | **Mapa de jornadas vivo** — casos, prioridade `[P0]`, achados. Atualizar sempre |
| [`testing/HANDOFF-vps-qa.md`](testing/HANDOFF-vps-qa.md) | Receita do ambiente fresco estilo VPS |
| [`runbooks/voice-qa.md`](runbooks/voice-qa.md) | Gate provider-free, smoke SIP, health/métricas e rollback; não substitui prova live |
| [`harness-audit.md`](harness-audit.md) | **Auditoria do harness** — 20 itens + nível de maturidade |
| [`../tests/e2e/README.md`](../tests/e2e/README.md) | Como rodar os E2E |

## 8. Execução — planos, épicos, handoffs

Documentação de *processo*. Alta rotatividade; trate como estado, não como contrato.

**Convenção observada:** épico **vivo** mantém o HANDOFF na **raiz** do repo; épico
**encerrado** é arquivado em [`handoffs/`](handoffs/). Use isso para saber o que está em voo.

- [`handoffs/HANDOFF-2026-09-01-consolidacao-agent-os.md`](handoffs/HANDOFF-2026-09-01-consolidacao-agent-os.md) — fechamento da consolidação de branches e continuidade das Fases 3/6/7 do Agent OS

- **Raiz (em voo):** `HANDOFF.md` (follow-up), `HANDOFF-harness-evolution.md`, `HANDOFF-operacao-visivel.md`
- [`handoffs/`](handoffs/) — arquivados: casos humanos, inbox multimodal, CRM vivo, LGPD, wave1-devvivo, contrato wave5, briefing CRM vivo
- [`stories/`](stories/) — épicos e stories (`epics/MASTER.md` = plano por epic/wave)
- [`superpowers/`](superpowers/) — `plans/` e `specs/` datados por onda, mais `handoffs/`
- [`superpowers/plans/2026-08-10-ai-platform-execution-index.md`](superpowers/plans/2026-08-10-ai-platform-execution-index.md) — ordem e estado da iniciativa AI Platform
- [`evidence/ai-platform/`](evidence/ai-platform/) — gates das Fases 0–1 e snapshot verificável da Fase 2; não confundir com ativação de provider
- [`growth/`](growth/) — material de crescimento · [`brand/`](brand/) — marca · [`white-label.md`](white-label.md) — instalação com marca própria
- [`../plan/`](../plan/) — backlog do gov-loop (`features.json` 31/31, `phases.md`, `progress.md`)
- [`../loop/`](../loop/) — máquina do gov-loop (`LOOP.md`, `CHECKPOINT.md`, `checkpoints/G1..G6-report.md` + `.approved`)
- [`../tasks/todo.md`](../tasks/todo.md) — workflow de construção original (Fase 0 → PRD → specs)

## 9. Grafo de conhecimento

`graphify-out/` — grafo do repositório (7310 nós, 17705 arestas, 538 comunidades na última
geração). Consulte via skill `graphify` antes de varrer código bruto. `GRAPH_REPORT.md` traz
god nodes, hyperedges e comunidades. **Gerado — não editar.** ⚠️ Foi gerado contra uma árvore
anterior à v1.0.0; regenere (`/graphify .`) antes de confiar em detalhe fino.

---

## Lacunas conhecidas deste índice

- `docs/archive/vendaval-fusion-plan.md` e `docs/archive/vendaval-vps-deploy-comandos.md`
  (movidos pra archive em 2026-08-25): a integração "Vendaval" **já foi absorvida em `main`**
  (jul/ago-2026, ver `docs/current-state.md` §3) — os planos ficam como registro histórico, não
  trabalho pendente.
- `docs/diagrams/` não tem `.md` e não foi inventariado. `docs/evidence/` é evidência visual
  (18 PNGs), não documentação de leitura.
- A doutrina (`CLAUDE.md`, DoD item 13) pede que o "mapa vivo" da arquitetura reflita toda peça nova
  com ≥2 arestas — **NÃO IDENTIFICADO** se isso está sendo cumprido em todos os artefatos.
- `docs/growth/` (3 docs) e `docs/brand/` (1) não foram lidos em detalhe — classificados por
  nome de pasta, portanto **INFERIDO**.

### Resultado da auditoria de 2026-08-25

- As mudanças de produto posteriores a `v1.2.0` estão registradas no `CHANGELOG.md` e
  detalhadas nas fontes técnicas correspondentes (`specs/11`, `specs/13`, `specs/15`,
  runbooks de AI e `current-state.md`).
- A contagem de arquivos e migrations foi atualizada contra `main @ 3cd5c48a`.
- Referências de deploy ao Traefik permanecem apenas no kit que suporta instalações com
  proxy externo; o runbook principal documenta Caddy como topologia real da VPS verificada.
- A migração de LGPD para privacy/RGPD é deliberadamente parcial no vocabulário: migrations,
  webhooks Nuvemshop e histórico de compliance preservam nomes legados para compatibilidade.
