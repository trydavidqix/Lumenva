---
type: current-state
project: DeskcommCRM
status: maintained
last_updated: 2026-09-04
generated_by: fechamento documental da consolidação de branches e integração faseada do Agent OS
confidence: média-alta (métricas de código são CONFIRMADO; estado de épico vem dos HANDOFFs, que são auto-relatados)
audited_against: main @ 197e65c860d12cf8b62ea543f78f7ff90a63f6c5 (origin/main; conferido em 2026-09-04)
---

# Estado atual — DeskcommCRM

## Reauditoria de sincronização — 2026-09-04 — CONFIRMADO

`main` local está alinhada com `origin/main` em `197e65c860d12cf8b62ea543f78f7ff90a63f6c5`. O histórico confirma:

- **Bloco 1 resolvido:** `lib/agent-engine/agent/skills-legacy.ts` era duplicata e foi removido em `1c5b964f`.
- **Bloco 2 resolvido parcialmente:** `@tanstack/react-virtual` não era usado e foi removido em `a69cbee4`; `@langchain/core`, `import-in-the-middle` e `require-in-the-middle` foram preservados por dependências peer/transitivas reais.
- **Rename confirmado na main:** Fase 1 cosmética em `1e1e216c`; Fase 2 de branding público em `197e65c8`/`175aee0b`. Fases 3–8 continuam explicitamente descopadas conforme [`docs/audits/rename-crm-to-lumenva-2026-08-31.md`](audits/rename-crm-to-lumenva-2026-08-31.md).
- **Integração Git confirmada:** esses commits estão alcançáveis a partir de `origin/main`; não há merge ou push adicional necessário.
- **Produção confirmada por leitura read-only do Supabase em 2026-09-04:** existem os agentes ativos `Briefing` e `Vendas`, roteados pelo router existente com `precisa_briefing` e `pronto_pra_proposta`, e a etapa `Novo (frio)` no pipeline `Leads Alfred`. É configuração de produto/dado, não schema; nenhuma migration é necessária.
- **Importador de leads:** `scripts/lead-pipeline/import-to-crm.py` existe somente na branch `feat/lead-pipeline-import-crm-2026-09-04` (`4c477990`), ainda fora de `main`. Lê linhas `Não contatado`, grava `contacts` + `crm_leads`, é idempotente por telefone e oferece `--dry-run`. A primeira rodada real foi confirmada no banco com **40 contatos e 40 leads** de `prospector_sheets`; não envia mensagens nem atualiza leads existentes.

Este bloco é estado temporal; não promove a branch de importação nem transforma configuração de produção em schema versionado.

**Fechamento documental do dia (2026-09-03):** o trabalho de hoje foi reconciliado neste
snapshot. O relay MCP de e-mail → WhatsApp foi testado de ponta a ponta e está **DONE —
confirmado funcional em produção**. O bug de desserialização dupla do Redis foi corrigido em
`lib/oauth/relay-store.ts` (`4b83a6c1`); as rotas OAuth passaram a fazer parsing manual do corpo
`application/x-www-form-urlencoded` (`0dba06b3`); e os caminhos de descoberta/handshake OAuth
foram liberados em `lib/auth/public-paths.ts` (`853cdcc2`, `ff0ad750`). O playbook de comportamento
de atendimento, as regras IA-12 a IA-15 e a seção VOZ estão documentados; a especificação de
personalização do tom de voz por tenant (`docs/specs/19-spec-tenant-voice-customization.md`) está
**DONE como contrato documental**. O plano de ligação de saída está pesquisado, mas **BLOQUEADO**
pela limitação de conta Twilio Trial. O catálogo de serviços/preços da Lumenva foi organizado no
Obsidian fora deste repositório.

O protótipo SIP (`scripts/voice-sip-test/`) recebeu correções de `turn_detection` e de
sobreposição de áudio, mas a prova de conversa continua **PENDENTE**: existe um loop intermitente
em que a IA repete apenas “a ligação de teste funcionou” em vez de conversar. O log registou um
erro real `response_cancel_not_active`, compatível com uma corrida de timing no cancelamento,
mas a causa raiz do loop ainda **não foi identificada nem resolvida**. Não declarar o protótipo
de voz como concluído; a pendência exige nova investigação e reprodução controlada.

Este documento existe porque "o que está pronto" estava espalhado em 5 `HANDOFF-*.md`
na raiz, `plan/progress.md`, `loop/checkpoints/`, `tasks/todo.md` e o roadmap do README —
sem lugar único. Um agente novo (ou o dono, depois de uma semana) não conseguia responder
"posso subir isso?" sem ler ~1500 linhas.

**Fechamento do dia (2026-09-01, `main` @ `60ed322f19c6bff962029bbe360f16f82913f7ae`; `origin/main` no mesmo SHA):** a fotografia abaixo foi reconciliada com `git log --since='2026-09-01 00:00' --until='2026-09-02 00:00'`. Hoje foram incorporados o lote Content OS e as correções C-1 (vocabulário `event_log`), C-2 (anti-SSRF) e C-3 (integridade cross-tenant), o gateway de canais por cherry-pick seletivo, os dois commits documentais de Agenda/Nuvemshop e a correção de idempotência do Vercel Workflow da Fase 7. Também entraram as integrações do Agent OS Fase 2 (Kernel), Fase 4 (SHADOW/evals) e Fase 5 (autonomia assistida). A Fase 3 (agentes de produto), a Fase 6 (flywheel) e a Fase 7 (benchmark durável) permanecem fora de `main` como linhas de continuação; não foram promovidas por risco de conflito/duplicação e, na Fase 7, ainda falta rerun completo do Vercel pós-fix.

O hardening de segurança `cacf6185` adicionou a migration `0134`: `content_os_enforce_tenant_fk()` é função `SECURITY DEFINER` usada por triggers internos, sem `EXECUTE` para `public`, `anon` ou `authenticated`, mantendo execução apenas para `service_role`. O histórico confirma limpeza parcial de refs, mas **não** uma limpeza total: ainda existem worktrees ativos de Content OS, gateway e Fases 2/4/5; portanto não arquivar nem declarar todas as órfãs removidas sem nova fotografia.

As contagens desta revisão são: 1.524 arquivos TS/TSX em `app`/`lib`/`components`/`workers`, 203 route handlers, 130 migrations SQL, 239 testes unitários, 78 testes de invariantes, 37 specs E2E e 298 documentos `.md`/`.mdx` em `docs/`. Estes números são snapshot do SHA acima.

**Reauditoria de sincronização (2026-08-25, `main` @ `3cd5c48a`; histórico):** esta revisão cruzou
o histórico desde `v1.2.0` com o código, migrations, testes, runbooks, specs e índice.
O checkout estava limpo e `main` estava alinhada com `origin/main`. Desde a última
revisão foram incorporados, entre outros, privacidade RGPD/GDPR, providers Google/Gemini,
Mem0 + Graphiti no worker (atrás de flags), Composio, tools MCP de anexos/notas, validação
Zod dos webhooks Meta/WAHA, rate limit dos webhooks públicos, hardening de tenant filter,
Phase 8/10, continuidade de casos humanos e a rede de segurança do realtime do inbox.
Os números da §1 foram remedidos naquela árvore; as afirmações de execução continuam
separadas de leitura estática e de evidência externa.

**Reauditoria de manutenção (2026-08-28, `codex/crm-consolidated` @ `54e86839`):** a árvore
consolidada foi conferida após as correções de RAG multi-agente e a sincronização documental
do Voice Core. A tabela da §1 foi atualizada para este checkout; o código de voz continua
deliberadamente fora dele e está descrito separadamente na §11. Esta revisão não reexecutou
a suíte: `node_modules` continua incompleto e os serviços externos necessários para E2E não
estão ativos.

**Aviso de método:** o estado de épico abaixo vem dos HANDOFFs, que são *auto-relatados
pelas sessões que fizeram o trabalho*. Estão densos em evidência (outputs de teste,
screenshots), o que é bom sinal, mas nada aqui foi re-verificado por execução nesta
auditoria — a auditoria é read-only por instrução. Métricas de código, contagem de
arquivos, conteúdo de CI e cobertura de padrão **foram** verificados diretamente.

**Revisão de manutenção (2026-07-30, `origin/main` @ `b190bbf`; histórico):** as contagens da §1 e as
versões de biblioteca do `AGENTS.md` foram remedidas por um mantenedor na revisão do PR #60.
Onde a régua divergiu, ela passou a ser declarada junto do número. O estado de épico (§2–§3)
**não** foi re-verificado nesta revisão — segue valendo o aviso acima.

**Revisão de manutenção (2026-08-19, `main` local @ `5eb118ef`, 3 commits à frente de
`origin/main`):** sessão operacional, não reauditoria — não recontou §1–§3. Cobre só o que foi
de fato executado/verificado nesta sessão, registrado em detalhe no §4.10:

- `test:db`/`test:invariants` deixou de exigir Docker — engine nativo (Homebrew `postgresql@17`
  + `pgvector`) com fallback automático, commit `7fe2929c`. Isto fecha, parcialmente, a
  "armadilha de conhecimento tácito" que o `harness-audit.md` já registrava no item 20.
- 3 bugs reais corrigidos e commitados em `main`: colisão de `NNNN` em migrations (`867d0203`),
  sintaxe inválida de `COMMENT ON ... || ...` que quebrava instalação fresh (`5eb118ef`),
  e uma race TOCTOU entre projeção de memória e anonimização LGPD (`cd2b7249` — **fica na
  branch `ai-platform-gate`, não em `main`**; não confundir com os dois primeiros).
- O projeto Supabase rotulado PRODUCTION (`idqlutosaqqqqxetepen`) nunca tinha recebido o
  schema — 3 tabelas existiam, `baseline.sql` nunca tinha sido aplicado de verdade lá. Aplicado
  agora (100 tabelas) e o histórico de migrations reconciliado (`supabase migration repair`,
  103 versões). Isto era um bloqueio de lançamento não documentado em lugar nenhum.
- **Achado novo, sem cobertura prévia em nenhum doc:** os templates de e-mail do Supabase Auth
  (`confirm-sign-up`, `reset-password`) e o SMTP customizado são configuração do **Dashboard do
  projeto hospedado**, não de `supabase/config.toml` — `config.toml` só se aplica a
  `supabase start` local ou via `supabase config push` (que também sobrescreveria `site_url`
  para `localhost`, então **não** é o comando certo para sincronizar produção). O projeto de
  produção estava usando os templates default do Supabase (`{{ .ConfirmationURL }}`, formato
  PKCE `?code=`), incompatíveis com a rota `app/auth/confirm/route.ts` (espera
  `?token_hash=&type=`) — cadastros confirmavam o e-mail mas nunca provisionavam a organização
  do tenant, silenciosamente. Corrigido colando manualmente o conteúdo de
  `supabase/templates/confirmation.html` e `recovery.html` no Dashboard. Sem gate automatizado
  contra essa deriva — ver §4.10.

---

## 1. Números do repositório — CONFIRMADO

**Versão:** `1.2.0` marcada em 2026-08-06, com alterações posteriores ainda em
`[Não lançado]` no `CHANGELOG.md`. A primeira release versionada foi `1.0.0` em 2026-07-27.

| Métrica | Valor |
|---|---|
| Arquivos TS/TSX em `app`+`lib`+`components`+`workers` | 1.524 |
| Route handlers (`app/api/**/route.ts`) | 203 |
| Migrations em `supabase/migrations/` | 130 arquivos (inclui Content OS e Agent OS) |
| Testes unitários (`tests/unit/*.test.ts(x)`) | 239 arquivos |
| Invariantes de banco (`tests/invariants/`) | 78 arquivos |
| Specs E2E (`tests/e2e/*.spec.ts`) | 37 |
| Documentos `.md`/`.mdx` em `docs/` | 298 |
| Import cycles | **0** (graphify, medido em árvore anterior) |
| `console.log` fora de `lib/logger.ts` | **0** |
| `: any` / `as any` | 7 |

**Higiene de código é boa.** Zero ciclos de import, logger centralizado respeitado,
quase nenhum `any`. Os god nodes do grafo (`fail` 325 arestas, `createAdminClient` 323,
`ok` 305, `audit` 290, `requireRole` 230) são *helpers canônicos* — indicam convenção
sendo aplicada, não acoplamento acidental.

**Doutrina de migrations está sendo cumprida** — CONFIRMADO: o apêndice idempotente de
`baseline.sql` acompanha as migrations atuais, incluindo Content OS e o forward-fix de
segurança `0134_content_os_enforce_tenant_fk_revoke`. Os
artefatos de schema andam juntos como a doutrina exige — o kit self-host recebe as
mudanças. Esse é o invariante mais fácil de quebrar num projeto open-source e ele está de pé.

---

## 2. O que está entregue

Conforme o roadmap do README (INFERIDO como fiel — cada item tem código e testes
correspondentes localizados no repo):

- **Fundação & plataforma** — auth com MFA para admin, multi-tenancy com RLS + teste de
  isolamento, RBAC de 4 papéis, audit log append-only, onboarding de tenant.
- **Atendimento WhatsApp** — inbox de 3 painéis em tempo real, conexões WAHA multi-número,
  mídia via Storage, anti-banimento (throttle + jitter + janela de horário), STOP detection.
- **CRM & pedidos** — kanban com vocabulário configurável por nicho (fractional indexing),
  customer 360, contatos, tags, Nuvemshop.
- **IA nativa** — agentes com RAG por tenant (pgvector), providers Anthropic/OpenAI/Google,
  Mem0/Graphiti atrás de rollout, Composio para tools externas, sentiment, handoff IA→humano,
  budget por org e MCP server interno.
- **Privacidade** — superfície administrativa/API migrada de `lgpd` para `privacy`, com
  vocabulário RGPD/GDPR, exportação/anonymização via workers e webhooks Nuvemshop mantidos
  sob o contrato de privacy; referências históricas a LGPD permanecem nos specs e migrations.
- **Self-host** — `hostgator-setup-kit`, `baseline.sql` auto-curativo, runbook de produção.
- **Webhooks & automação** — captação + regras QUANDO/SE/ENTÃO + gatilhos externos.
- **Operação visível** — transparência do motivo de retenção anti-ban, central de avisos,
  knobs de proteção de envio, propostas do flywheel com gate humano.

### Épico de Governança de Atendimento (G1–G6) — COMPLETO

CONFIRMADO em `plan/features.json` (31/31 features com `passes: true`) e
`loop/checkpoints/` (relatórios G1–G6 + os 6 arquivos `.approved`).
Guiado por 100+ invariantes de banco. Fechou em 2026-07-18.

Entregou: RBAC server-side em toda a API, atribuição e transferência auditadas
(IA como assignee de primeira classe), visibilidade por papel via RLS, métricas por
atendente, roteamento automático com fila e painel de gestão, e `docs/specs/14` —
o contrato de governança para agentes de IA externos.

### Relay e-mail → WhatsApp (GPT Action) — CONFIRMADO em produção 2026-09-02

Código integrado em `main` desde `8798ae89` (ver
[`docs/integrations/email-whatsapp-relay.md`](integrations/email-whatsapp-relay.md) e
[`docs/handoffs/HANDOFF-2026-09-02-email-whatsapp-relay.md`](handoffs/HANDOFF-2026-09-02-email-whatsapp-relay.md)).
Nesta sessão o caminho completo foi testado de ponta a ponta contra produção real
(`crm.lumenva.pt`) e confirmado: chamada real via GPT Action do ChatGPT Work → `POST
/api/internal/notifications/email` → mensagem chegou no WhatsApp do dono.

Dois achados operacionais registrados durante o teste, não documentados antes:

- **Deploy da VPS estava desatualizado.** `git pull` tinha trazido o commit do relay, mas
  o container `deskcommcrm-app-1` continuava rodando a imagem Docker antiga (a rota
  respondia 404). Rebuild + `up -d` conforme `docs/runbooks/deploy.md` resolveu. Não há
  gate que avise quando o container roda atrás do `git log` local — é um gap operacional
  aberto, não coberto por este handoff.
- **O envio falha fechado (por design) se o contato do dono não tiver `phone_number`
  preenchido**, mesmo que `EMAIL_RELAY_OWNER_WHATSAPP_E164`/`EMAIL_RELAY_ORGANIZATION_ID`
  estejam corretos. Nesta VPS o contato do dono existia (criado via inbound antigo com
  identificador `@lid` do WhatsApp, sem telefone associado) mas com `phone_number` vazio —
  a chamada real retornava `502 internal_error` sem detalhe. Corrigido preenchendo o
  telefone manualmente nesse contato. Antes do primeiro envio autorizado em qualquer
  ambiente novo, confirme que existe contato + conversa com `phone_number` preenchido para
  o número configurado — o handoff original já pedia essa validação, mas não descrevia
  esse sintoma específico.

Automação total (ler Gmail automaticamente antes de chamar a Action) segue pendente: GPTs
customizados do ChatGPT não suportam conector Gmail junto com Actions na mesma superfície;
precisaria de um conector MCP dedicado (não construído ainda).

---

## 3. O que está incompleto — por épico

| Épico | Estado relatado | O que falta |
|---|---|---|
| **Follow-up inteligente** (`HANDOFF.md`) | Ondas 1–7 ✅; Onda 8 **em andamento** (8.1 gatilho de silêncio ✅, 8.3 jornada E2E ✅) | gatilho `stage_change`, flywheel, e o fechamento do checklist DoD/PRD da 8.3 |
| **Evolução do harness** (`HANDOFF-harness-evolution.md`) | **ÉPICO COMPLETO** — Fases 0–4 fecharam, a última (Painel de Evolução) em 2026-07-27. Mais duas continuações entregues: mapeamento de funil do agente (27/jul) e gerenciar etapas do funil (28/jul) | **nada** — a prova de ponta a ponta (mensagem real de WhatsApp) já tinha fechado em 2026-07-27 (`evidence/f4-prova-real-whatsapp.png`); esta linha estava desatualizada, corrigido 2026-08-25 |
| **Operação visível** (`HANDOFF-operacao-visivel.md`) | **4/4 fechado — F1/F2(i)/F2(ii)/F3 provados na VPS de produção real (`crm.lumenva.pt`), confirmado 2026-08-25.** O HANDOFF original tinha provado contra servidor errado (`129.121.45.100:18080`, não é produção); refeito. F2(i)/F2(ii) exigiram seedar dado de teste no tenant `e2e-test-org` (script novo `scripts/seed-e2e-operacao-visivel.ts`, idempotente, nunca toca o tenant Lumenva). F3: aba "Propostas" some no agente de teste porque propostas são org-scoped — confirmado comportamento esperado, não bug | **nada.** Achado lateral não investigado: `/app/connections` retorna 403 pro role `manager` (só `admin` passa) — pode ser RBAC intencional ou bug, registrar se virar problema real |
| **Casos humanos** (`docs/handoffs/HANDOFF-casos-humanos.md`) | **Fechou — confirmado 2026-08-25.** Código em `main`, mantido ativamente (`ddff0978`, 22/ago, corrigiu bug real de continuidade — o mesmo `agent_cases` órfão fechado nesta sessão). Wave 7 foi provada ao vivo (não virou spec Playwright versionado — `tests/e2e/human-cases.spec.ts` do plano original nunca foi escrito) | Dívida de processo, não de produto: escrever `tests/e2e/human-cases.spec.ts` pra não depender só de `escalacao-ciclo.spec.ts` como rede indireta. Não pôde ser reexecutado nesta auditoria por falta de Docker na estação (mesma limitação já registrada em §7) |
| **Inbox multimodal** (`docs/handoffs/HANDOFF-inbox-multimodal.md`) | Ondas 0–5 (+5.1/5.2/5.3) ✅ — confirmado em `main` (PR #34/#36 mergeados), código+migration+teste+rota-na-nav pra split de mensagens, templates, rascunho IA, notas internas, snooze. *(Correção 2026-08-25: "ondas 4–6" era impreciso — o épico vai só até a onda 5+subondas, não existe onda 6.)* | Nada estrutural. **Único ponto ainda aberto — dado de runtime, não código:** se a credencial Anthropic (era `last4 1234`, placeholder) e a chave Google (era de gateway, não AI Studio direto) foram trocadas por reais — isso vive em `ai_agent_credentials` no banco, não dá pra confirmar por leitura de código |
| **Fase FG / Vendaval** | **FEITA — absorvida em `main`** (não estava "não iniciada"; corrigido 2026-08-25) | Nada. Mesclada em 3 ondas (`f3654029`, `1cc49d55`, `cd0f4d39`), 221 commits em `lib/agent-engine/` desde então, o mais recente 3 dias antes desta auditoria. `docker-compose.prod.yml` já tem o serviço `worker`. README não lista mais "Fase FG" porque virou trabalho corrente ("IA nativa"/"flywheel"), não porque saiu de escopo. `docs/vendaval-fusion-plan.md` e `docs/vendaval-vps-deploy-comandos.md` cumpriram o papel — candidatos a `docs/archive/` |

### Próximo no roadmap (não iniciado — CONFIRMADO no README)

MCP público · flywheel de auto-aprimoramento · templates por nicho (clínica,
imobiliária, infoproduto, serviços) · VTEX e Shopify via adapter · identity probabilística.

### Dois achados de produto registrados e não endereçados

Vêm do `HANDOFF-harness-evolution.md`, anotados como "não são desta feature":
**transbordo de layout a 390px em qualquer tela** e **não existe caminho de criação de
funil** (só de etapas). O primeiro é bug de primeira impressão em mobile.

---

## 4. O que está quebrado ou frágil — CONFIRMADO

Estes são achados de código/config verificados nesta auditoria, não relatos.

### 4.1 Os E2E quase não rodam no CI 🟠 — parcialmente resolvido em 2026-07-30

> **Atualização (2026-08-05, issue #63):** `e2e.yml` roda **28 das 32 specs** contra Supabase
> local com o `baseline.sql` aplicado. Não-obrigatório ainda. A primeira execução real já
> pagou o job: achou a página `/500`, que `public-paths.ts` declarava pública e **nunca havia
> sido criada**. A rodada de 2026-08-05 pagou de novo: as 12 specs do épico IA 360 nunca
> tinham entrado no gate, e ao rodá-las apareceu um defeito de produto real
> (`capacidades-do-agente` — o teto de 20 capacidades desabilita a crítica que o desenho manda
> marcar à mão). As 4 restantes seguem sem gate — o texto abaixo continua valendo para elas.

O gate de isolamento RLS **roda** — `ci.yml` tem o job `invariants` chamando `pnpm test:db`,
que sobe `pgvector/pgvector:pg17`, aplica `baseline.sql` em modo install e update, e roda os
78 arquivos de `tests/invariants/`. Esse buraco está fechado como cobertura versionada;
GitHub Actions está inativo e a execução atual é manual/local.

O que continua fora: **4 das 32 specs Playwright**. A `vps-webhook-outbound-ssrf.spec.ts`,
única prova automatizada do guard de SSRF, **passou a rodar** no `e2e.yml`. Mas a
`vps-fresh-onboarding.spec.ts` — a jornada que a doutrina de QA Visual classifica como o
caminho mais crítico do produto — continua fora, porque exige WAHA + Redis + Resend +
Nuvemshop no runner. Regressão nela passa sem detecção (issue #63).

O `e2e` também **ainda não é check obrigatório** na branch protection, que exige apenas
`verify`, `build-and-size` e `invariants`. Enquanto for opcional, um PR que quebre o e2e
entra na `main` assim mesmo. **Ponto morto adicional (2026-08-20): GitHub Actions está
desabilitado permanentemente (§10)** — `e2e.yml` não dispara mais de forma nenhuma, então
"não obrigatório" já nem é a questão certa; hoje esta spec só roda se alguém a disparar
manualmente com Docker de pé (Supabase local + WAHA + Redis).

**Tentativa de rodar nesta sessão (2026-08-20):** bloqueada de saída — Docker indisponível
nesta estação (decisão do usuário de não rodar Docker no Mac), e a spec exige Supabase local
via `supabase start` + WAHA + Redis, todos Docker. Sem isso, fiz revisão estática em vez de
execução: li o spec inteiro (13 casos, J1.1–J1.13) contra o código real de cada tela —
`app/onboarding/layout.tsx` (gate onboarded_at → redirect), `app/onboarding/page.tsx` (router
de step), `welcome/_form.tsx` + `acceptWelcome.ts`, `connect-whatsapp/_client.tsx` +
`skipWhatsapp.ts`, `setup-ai/_form.tsx` + `createDefaultAgent.ts`, `invite-team/_form.tsx` +
`sendOnboardingInvites.ts`, `finishOnboarding.ts`, `MfaEnrollGate.tsx`, e o `_shared.ts` comum
a todas as actions. **Nenhum defeito encontrado** — inclusive as duas regressões que o spec
documenta terem sido corrigidas (redirect hardcoded pro Nuvemshop em vez de deixar o router
decidir; gate MFA desmontando via revalidação do Server Action e perdendo os códigos de
recuperação) batem com o código atual (`useState(!enrolled)` latching em
`MfaEnrollGate.tsx:26`, `redirect("/onboarding")` em vez de rota fixa em `skipWhatsapp.ts:19`).

**O que isso NÃO prova**, e por que continua sendo um gap real: leitura estática não exercita
render de imagem (o QR code realmente carrega bytes válidos?), não prova timing real de TOTP
contra o banco, não prova RLS sob concorrência, não prova o handshake HMAC do WAHA de verdade.
Fica aberto até alguém rodar com Docker disponível (VPS de teste, ou Docker Desktop
temporariamente nesta estação).

`vitest.config.ts:12` exclui `tests/invariants/**` e `tests/e2e/**` do `test:unit`. Para os
invariantes isso é deliberado e correto (o job de CI os pega). Para os E2E, o `e2e.yml` pega
metade.

### 4.2 `pnpm gov:verify` não é o comando único que aparenta ser 🟠

`gov:verify` = `typecheck && lint && test:unit`. Omite `test:db` e `test:e2e`. Um agente
que trate `gov:verify` verde como "pronto" vai declarar concluída uma mudança de schema
sem nunca ter testado RLS. O CI pega o `test:db` depois do push, mas o loop local mente —
e o nome do script sugere cobertura total que o conteúdo não entrega.

### 4.3 Rate limit HTTP — ✅ fechado em 2026-08-20 (era 🔴 desde a auditoria de julho)

**Achado desta auditoria (julho/2026), já obsoleto no código:** afirmava que `checkRateLimit`
só era chamado em 2 lugares (webhook de captação + dispatcher de IA), com `/login`, `/signup`,
`/team/accept-invite/:token`, crons, `/api/internal/*` e `/api/mcp` desprotegidos. Isso não
reflete mais o repo — a issue #64 (antes desta sessão) já tinha coberto login/signup/reset/MFA/
convite via `lib/auth/rate-limit.ts`, e `/api/mcp` + `/api/internal/agents/run` já tinham
`checkRateLimit` próprio. Os crons são protegidos por secret fail-closed (`INTERNAL_CRON_SECRET`),
não por rate limit — controle correto para superfície não pública.

**Gap real, confirmado e fechado nesta sessão:** os 7 webhooks públicos de canal/integração
não tinham nenhum rate limit — HMAC valida a assinatura, mas só depois de já ter recebido e
processado o corpo, então um flood de POSTs (mal-formados ou não) consumia I/O/CPU antes de
qualquer rejeição. Adicionado `checkRateLimit` (mesmo padrão já usado no webhook de captação),
o mais cedo possível após resolver o identificador de tenant, antes de qualquer lookup no banco:

- `webhooks/waha/[token]` e `webhooks/waha` (global) — 120/min por sessão;
- `webhooks/meta/[token]` (POST) — 120/min por sessão;
- `webhooks/nuvemshop/[event]` — 60/min por loja;
- `webhooks/nuvemshop/store-redact`, `customer-data-request`, `customer-redact` (LGPD) —
  30/min por loja (evento raro/crítico; teto baixo ainda permite retentativa legítima).

Sem teste de rota dedicado (nenhum dos 7 handlers tinha harness de teste antes desta mudança —
exigiria mockar Supabase admin client + HMAC por webhook; fora do escopo desta correção). Prova:
`pnpm typecheck` e `pnpm lint` limpos, diff mínimo (80 linhas, 7 arquivos, mesmo padrão de 4
linhas repetido, já em produção em 3 rotas — `webhooks/in/[token]`, `/api/mcp`,
`/api/internal/agents/run`). Detalhe/impacto original em [`threat-model.md`](threat-model.md).

### 4.4 `node_modules` deste checkout está incompleto 🟠

70 pacotes, sem `typescript` — `pnpm typecheck` falha com `MODULE_NOT_FOUND`. Resolve-se com
`pnpm install` (não executado: a auditoria é read-only). Consequência para esta auditoria:
nenhuma afirmação sobre "os testes passam" pôde ser verificada por execução.

### 4.5 `.env.example` — ✅ fechado em 2026-08-20 (era 🟠 desde a auditoria de julho)

**Achado original (julho/2026), já resolvido antes desta sessão:** 6 variáveis declaradas em
`lib/env.ts` estavam ausentes do template (`IMPERSONATE_COOKIE_SECRET`, `INTERNAL_CRON_SECRET`,
`LGPD_SIGNING_KEY`, `LGPD_DPO_EMAIL`, `LGPD_EXPORT_EXPIRES_HOURS`, `NUVEMSHOP_ENABLED`).
Confirmado nesta sessão: as 6 já estão no `.env.example` atual — não sei quando foram
adicionadas, só que já não é gap.

**Achado "inverso" original (`FLYWHEEL_*`/`WATCHDOG_*` no template, ausentes de `lib/env.ts`):**
era descrito como "menos grave, sem validação Zod" — **incorreto**. Essas vars (mais
`CRON_STAGGER_WINDOW_MS`, `FOLLOWUP_MIN_AHEAD_MS`, `FOLLOWUP_MAX_AHEAD_MS`) são validadas por
Zod em `lib/agent-engine/env.ts`, um schema separado para o processo standalone do worker do
agent-engine — `lib/env.ts` é só o schema do processo Next.js. Não é gap; é fronteira de
processo correta, e a auditoria original não sabia da existência do segundo arquivo.

**Gap real, confirmado e fechado nesta sessão:** o mesmo padrão se repetia com o canal oficial
(Meta/WhatsApp Cloud API) — 6 vars (`META_APP_SECRET`, `META_WABA_ID`, `META_PHONE_NUMBER_ID`,
`META_SYSTEM_USER_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`, `META_GRAPH_VERSION`) já estavam no
template, mas eram lidas via `process.env.META_*` cru em 6 arquivos (3 rotas + 3 módulos de
`lib/channels/meta/`), sem passar pela validação de `lib/env.ts`. Adicionadas ao schema
(opcionais, mesmo padrão já usado para Nuvemshop) e os 6 call sites trocados para `env.META_*`.
`META_APP_ID` segue no template sem uso no código — mantido como nota informacional pro
self-hoster (aparece no painel de parceiros da Meta ao criar o app), não é gap de validação.
`scripts/spike-*.ts` e `tests/journeys/canal-oficial.spec.ts` continuam lendo `process.env`
direto de propósito — ferramentas fora do boot do app, não passam pela validação de produção.

Prova: `pnpm typecheck` limpo, `pnpm lint` limpo nos arquivos tocados, 58/58 testes unitários
relevantes (`meta-webhook*`, `send-template-wiring`, `meta-send-template*`) passando.

### 4.6 `ARCHITECTURE.md` tinha três afirmações falsas 🟡

Corrigidas nesta auditoria: dizia Next.js 15 (é 16.2), "rate limit sliding window"
(é fixed-window, e só em 2 pontos), e "`Idempotency-Key` para POSTs de criação" (existe
em **1** rota). Documentação que promete garantia inexistente é pior que documentação
ausente — um agente confia e não implementa.

### 4.7 Sem proteção automática contra vazamento de secret 🟡

Não há gitleaks/trufflehog no CI, nem pre-commit hook (`.husky`/`.pre-commit-config.yaml`
ausentes). `.gitignore` cobre `.env*` corretamente — a proteção é só essa camada.

### 4.8 ✅ Raiz do repositório — resolvido

Registrado porque a primeira passada desta auditoria apontou 11 PNGs de evidência
commitados na raiz. **Já foram movidos**: hoje há **zero** PNGs rastreados na raiz — a
evidência vive em `evidence/` (85, contando as subpastas), `docs/evidence/` (18) e
`loop/checkpoints/evidence/` (13) — **116** no total.
Dois HANDOFFs também migraram para `docs/handoffs/`. Restam 3 na raiz (`HANDOFF.md`,
`-harness-evolution`, `-operacao-visivel`), o que é consistente com "épico vivo fica visível,
épico encerrado é arquivado".

### 4.9 Divergências de estado nos HANDOFFs 🟡

`HANDOFF.md` afirma "Migration seguinte livre: **0058**" e lista pendência de aplicar `0057`
 no dev DB — mas o repo já tem migrations até **0125**. São 67 migrations de deriva. É
consequência natural de trabalho em branches paralelas, mas ilustra a regra:
**HANDOFF não é fonte da verdade de schema** — `supabase/migrations/` e `baseline.sql` são.
**A CONFIRMAR:** se a pendência de dev DB de `0057` ainda existe.

### 4.10 Templates de e-mail e SMTP do Supabase Auth não sincronizam com `config.toml` 🔴 — corrigido no projeto de produção em 2026-08-19

Achado desta sessão, não coberto antes em nenhum doc. `supabase/config.toml` declara
`[auth.email.template.confirmation]`/`[auth.email.template.recovery]` apontando para
`supabase/templates/*.html` (que usam `?token_hash={{ .TokenHash }}&type=...`, o formato que
`app/auth/confirm/route.ts` espera). Isso só é aplicado automaticamente em `supabase start`
local. Um projeto hospedado (self-host na nuvem do Supabase, como o de produção deste app)
**não herda esses templates só por existirem no repo** — precisam ser colados manualmente em
Dashboard → Authentication → Emails → Templates, ou via `supabase config push` (que também
reescreveria `site_url` do projeto para `http://localhost:3000`, então não é o comando certo
para produção sem antes limpar as chaves não relacionadas a e-mail do `config.toml`).

**Sintoma quando isso está errado:** cadastro via `/signup` funciona, o e-mail chega
(especialmente depois de configurar SMTP customizado), o link confirma o e-mail (porque o
GoTrue hospedado processa `?code=` no próprio endpoint antes de redirecionar) — mas
`ensureTenantForUser()` nunca roda, porque a rota `/auth/confirm` só reconhece
`?token_hash=&type=`. O usuário loga normalmente depois e cai em "Você não tem nenhuma
organização ativa", sem nenhum erro nos logs do app (a falha acontece inteiramente do lado do
Supabase, antes do redirect chegar na rota).

Corrigido manualmente no Dashboard do projeto de produção nesta sessão. **Não há gate/teste que
detecte essa deriva automaticamente** — se o Supabase resetar os templates (recriação de
projeto, mudança de plano, etc.) ou um projeto novo for provisionado sem repetir esse passo
manual, o mesmo bug volta a acontecer silenciosamente. Candidato a runbook/checklist de deploy
(`docs/runbooks/deploy.md`) e possivelmente a um invariante de `test:e2e` que exercite o link
de confirmação real contra um projeto Supabase fresco.

Também descoberto nesta sessão, sem relação direta com o bug acima: o projeto de produção não
tinha SMTP customizado configurado (só o serviço default do Supabase, ~2 e-mails/hora) — bloqueio
de lançamento real, já que qualquer teste de reset de senha esgotava a cota. Configurado com
Resend (domínio `lumenva.pt`, já verificado) e testado com entrega real confirmada via API do
Resend.

---

## 5. Riscos técnicos abertos

1. **`createAdminClient` (service role, bypassa RLS) — 🟡 gate heurístico adicionado em
   2026-08-20, risco reduzido mas não eliminado.** O achado original (julho/2026: 89 dos 169
   handlers, sem enforcement automático na escrita) motivou `pnpm lint:tenant-filter`
   (`scripts/lint-tenant-filter.ts`, no `gov:verify`), mesma catraca do `lint:channels`: handler
   de `app/api/**/route.ts` com `createAdminClient` + query `.from()` direta + zero menção a
   `organization_id`/`organizationId` no arquivo reprova o merge.

   **O que isso prova e o que não prova** (documentado em
   `scripts/lint-tenant-filter.pattern.ts`): não é dataflow analysis — não confirma que o filtro
   usa o org CERTO, e não enxerga filtro feito dentro de um helper que recebe `orgId` como
   parâmetro (medido ao construir o gate: 4 dos 9 arquivos da primeira passada eram exatamente
   esse falso positivo — `ai/cases/route.ts` e `[id]/route.ts` delegam a `lib/escalacao/chamados.ts`,
   que filtra corretamente, só que num arquivo diferente do que o predicado lê). Pega só a classe
   mais simples e mais provável de erro: handler novo que esqueceu o `.eq()` de vez. Os 78 arquivos
   de invariante (RLS/schema) continuam sendo a prova real de isolamento; este gate é triagem na
   escrita, não substituto.

   3 arquivos em `KNOWN_DEBT` (lidos individualmente, não "provavelmente ok"): `admin/platform-admins`
   (único papel cross-tenant do contrato base), `system/update`+`system/agent`+`system/version`
   (dado de instalação self-host, não de tenant), `cron/attendant-heartbeat` (varredura
   system-wide documentada no próprio arquivo, AT-08). Nenhum é um vazamento — os 9 candidatos da
   heurística inicial foram todos lidos manualmente e nenhum é bug real.
2. **Fallback in-memory do rate limit** (`rate-limit.ts:23`): sem Upstash configurado — o
   estado normal de um primeiro deploy — o limite passa a ser por processo. Silencioso além
   de um `logger.warn`.
3. ✅ **`ffmpeg` na imagem** — era contingência aberta no HANDOFF; **resolvido**:
   `Dockerfile:55` faz `apk add --no-cache ffmpeg`, com comentário explicando que a derivação
   de vídeo roda no processo do app via o cron `event-log-drain`. Registrado como fechado.
4. **Dependência de credencial de terceiro para provar IA**: se Anthropic segue com credencial
   placeholder e Google com chave de gateway inválida, o caminho multimodal está provado em um
   único provider (OpenAI) apesar de o design ser model-agnostic. **A CONFIRMAR** se ainda vale.
5. **`lib/agent-engine/agent/inbound-turn.ts` com 1789 linhas** — 2,4× o segundo maior arquivo
   de lógica (`AgentForm.tsx`, 746), e é o hot path do produto. Cresceu ~200 linhas desde a
   primeira medição desta auditoria.
6. 🟡 **Debug temporário de realtime, deployado na VPS de produção mas NÃO commitado no
   git** (`lib/supabase/browser.ts`, `hooks/realtime/useRealtimeChannel.ts`) — investigação de
   2026-08-21 de um bug intermitente (mensagens do WhatsApp não atualizam ao vivo no inbox sem
   refresh manual). `console.warn("[TEMP DEBUG realtime] ...")` foi adicionado nos dois arquivos
   e o build correspondente está rodando em `/root/deskcommcrm` (container `app`) desde então —
   mas `CLAUDE.md` proíbe `console.log`/debug em código merged, então essas duas mudanças ficam
   fora do git de propósito. `git status` local mostra os dois arquivos como modificados; isso é
   deliberado, não deriva acidental. SDK/rede do Supabase Realtime foram provados corretos
   independentemente (script Node.js local conectou e recebeu evento mesmo anonimamente); a
   hipótese líder é falha intermitente de auth no socket realtime ou expiração de JWT em aba de
   longa duração. **Ação pendente:** reverter os dois arquivos na VPS (rebuild + redeploy) assim
   que o bug reproduzir com log capturado, ou quando a investigação for formalmente abandonada.

---

## 6. Perguntas para o responsável

1. Qual é a prioridade para "iniciar minimamente o sistema": fechar a Onda 8 de Follow-up ou
   estabilizar segurança (rate limit) antes de tudo? *(a prova de WhatsApp real do harness já
   fechou em 2026-07-27 — não é mais item desta pergunta, corrigido 2026-08-25)*
2. ~~A Fase FG (Vendaval) saiu de escopo?~~ **Resolvido nesta auditoria**: não saiu de escopo,
   está absorvida em `main` desde jul/ago-2026 (ver §3). `docs/vendaval-fusion-plan.md` e
   `docs/vendaval-vps-deploy-comandos.md` cumpriram o papel — mover pra `docs/archive/`.
3. Casos Humanos Wave 7 e Inbox Multimodal ondas 4–6 fecharam? Os HANDOFFs foram arquivados
   em `docs/handoffs/`, o que sugere sim, mas o texto interno ainda diz PARCIAL.
4. A credencial Anthropic e a chave direta do Google AI Studio foram providenciadas?
5. Os dois achados de produto registrados e não endereçados — transbordo a 390px e ausência
   de criação de funil — entram em qual momento? O primeiro é bug de primeira impressão mobile.
6. `pnpm gov:verify` deve passar a incluir `test:db` (exige Docker em toda máquina de dev)
   ou fica um `verify:full` separado?
7. As branch protection rules exigem os dois checks do CI verdes para merge? Isso decide se o
   gate de RLS é bloqueante ou decorativo.

---

## 7. Não pôde ser confirmado

- Se `pnpm typecheck` / `lint` / `test:unit` passam **hoje** — o `node_modules` deste checkout
  está incompleto e a auditoria não instala dependências.
- Se o job `invariants` do CI está passando — sabemos que existe, não que está verde.
- Se os E2E passam hoje — exigiriam Docker, banco e app rodando.
- Estado real do banco de dev/produção — nenhuma conexão foi aberta.
- Números de teste citados nos HANDOFFs (533 unit, 236 db, 547 unit em datas diferentes) —
  auto-relatados e não reconciliam entre si. O inventário deste checkout contém **194 arquivos**
  em `tests/unit/` e **75** em `tests/invariants/`; isso conta arquivos, não casos executados,
  e não substitui uma execução da suíte.
- Cobertura de teste (%) — `coverage` está configurado no Vitest, mas nenhum relatório foi gerado.
- Se `docs/architecture/` cumpre o "mapa vivo" exigido pelo item 13 do DoD (contém só o
  diagrama do agent-turn).
- Estado de conclusão real dos épicos arquivados — ver pergunta 3.

---

## 8. Nota de método

A primeira passada desta auditoria rodou contra um checkout **556 commits atrás** da
`origin/main`, e por isso reportou como achado principal um problema (gate de RLS fora do CI)
que já estava corrigido em produção, e descreveu o épico de Evolução do Harness como "Fase 0,
Task 1" quando ele estava completo. A reauditoria corrente está em `main @ 3cd5c48a`;
o SHA antigo permanece apenas como referência histórica da primeira passada.

Duas lições que valem para quem mantiver este documento:

1. **`git fetch` antes de auditar.** A doutrina de higiene de branches do `CLAUDE.md` existe
   por isso; ignorá-la produziu um documento que desinformava com confiança.
2. **Este arquivo apodrece rápido.** O repo moveu 556 commits em poucos dias. Trate as datas
   do frontmatter como prazo de validade, não como enfeite — e prefira reconferir os números
   com os comandos citados a confiar na tabela.

---

## 9. Auditoria de branches (2026-08-19/20) — não reconta §1–§3, é levantamento à parte

Sessão dedicada a mapear toda branch local/`origin` fora da `main` e decidir destino: apagar
(já 100% mesclada) ou investigar por que não mergeou. `upstream/*` (fork de
`melgarafael/DeskcommCRM`) ficou fora do escopo — não são branches deste time.

### 9.1 Apagadas nesta sessão — já estavam 100% em `main`

`ai-platform-foundation` (local + `origin`), `fix/e2e-redis` (local), `feat/lumenva-website`
(local — o único commit pendente, troca de ícones do footer, foi conferido contra `main` e
achado **superado**: `main` já resolveu o mesmo problema de forma mais completa via
`LumenvaMark`/`socialIconMap` em `components/ui/BrandIcons`; o commit ficou preservado no
histórico da branch antes de apagar, não foi portado).

### 9.2 Mantidas — trabalho real, decisão pendente

| Branch | À frente de `main` | Situação |
|---|---|---|
| `ai-platform-gate` (local) | 3 commits | Fix isolado de race TOCTOU LGPD×Mem0 (`cd2b7249`, ver §4.10 nota anterior). Pequeno, testado, nunca teve PR aberto |
| `gpt-lumenva-content-os` (local) | 24 commits local / 7 no `origin` | **17 commits só no local, nunca pushados** — sistema de inteligência de conteúdo (providers RSShub/changedetection) em desenvolvimento ativo. Risco de perda se a máquina falhar antes de um `git push` |
| `agent-os-phase-7-durable-benchmark` (local + `origin`) | 235 commits | Sob auditoria ativa por sessão paralela nesta mesma janela; achados já confirmados: Fases 9/14 têm flag ligada sem rota HTTP por trás, Fase 7 (benchmark) incompleta, Fase 13 tinha teste especulativo |

### 9.4 Segunda rodada de limpeza (2026-08-20) — PRs de bot + duplicatas confirmadas

Apagadas por serem cópias exatas/ancestrais diretas de branches já mantidas, zero conteúdo
próprio, zero PR associado (conferido no repo certo, ver correção do §9.3):

- `origin/agent-os-phase-5-verification` — mesmo commit exato de `agent-os-phase-2-kernel`.
- `origin/agent-os-phase-7-durable-benchmark-planning` — ancestral direta de
  `agent-os-phase-7-durable-benchmark` (mantida), tudo que tinha já está contido nela.

Fechados dois PRs de dependency bump com 4+ checks falhando (`verify`/`e2e`/`build-and-size`/
`invariants`), sem relação com as branches acima:
[#24](https://github.com/trydavidqix/CRM/pull/24) (dependabot, 17 updates em grupo) e
[#21](https://github.com/trydavidqix/CRM/pull/21) (dependabot, `pdf-parse` 1.1.4→2.4.5, breaking
changes documentadas). O PR [#22](https://github.com/trydavidqix/CRM/pull/22) (seu, draft,
rastreando `agent-os-implementation-plan`) foi mantido aberto de propósito — é WIP real, não
lixo de bot.

### 9.3 Iniciativa "Agent OS" — 8 branches só no `origin`, quase nenhuma com PR, nenhuma mergeada

Todas nascem do plano `docs/superpowers/plans/2026-08-17-agent-os-master-implementation-plan.md`
(fases 1–9, cada `PLAN N.M` com seu próprio GO gate). Investigadas em paralelo por subagentes
Explore, um por branch/par, lendo só via `git show <branch>:<path>` (nenhum checkout).
Datadas todas de 17–18/08/2026.

**Correção (2026-08-20):** a varredura original de PR usou `gh pr list`/`gh pr view` sem
`--repo` explícito, e o `gh` resolveu contra o remoto `upstream` (`melgarafael/DeskcommCRM`,
o fork original) em vez do `origin` (`trydavidqix/CRM`, este repositório) — produzindo "nenhuma
teve PR" como conclusão errada. Refeito contra o repo certo: **duas das 8 tiveram PR**,
`agent-os-implementation-plan` → [PR #22](https://github.com/trydavidqix/CRM/pull/22)
("Agent OS Phase 1 foundation (draft)", ainda **OPEN**) e `agent-os-verification` →
[PR #23](https://github.com/trydavidqix/CRM/pull/23) ("Agent OS verification gate (draft, do
not merge)", **CLOSED**). As outras 7 seguem sem PR nenhum. Isso não muda o veredito técnico
de cada branch (código real vs. scaffolding, tabela abaixo) — só a afirmação sobre processo.

**Achado estrutural, contra a hipótese inicial:** não são 8 experimentos isolados sem relação
entre si — `agent-os-verification` é uma branch de "transporte" que acumula o código das fases
1–6 num único histórico contínuo (kernel + autonomia + memória + flywheel + guardrails +
playbooks coexistem na mesma árvore). O gate de cada fase historicamente rodou via preview
deploy manual na Vercel, nunca via GitHub Actions/CI — o PR #22 aberto e nunca fechado sugere
que a intenção de formalizar via PR existia, só não foi seguida adiante nas fases seguintes.

| Branch | Commits à frente | Veredito | Achado central |
|---|---|---|---|
| `agent-os-implementation-plan` (Fase 1 — Foundation 1.1–1.6) | 107 | **PARTIAL–REAL** | Contratos/testes substantivos (`lib/agent-engine/contracts/agent-os.ts`, 321 linhas + testes; golden dataset de 13 cenários real). Evidência cita SHAs e deployment ID da Vercel específicos, verificável contra a árvore. Mas o diff também **apaga** código de produção existente (workflows LangGraph de proposta/lead-scoring) — rip-and-replace nunca revisado |
| `agent-os-phase-2-kernel` (Fase 2 — Agent Kernel) | 164 | **PARTIAL** | Kernel real de 312 linhas (`lib/agent-engine/kernel/agent-kernel.ts`) com loop de execução completo (budget, retry, aprovação, idempotência), 30/30 arquivos de teste passando local. **Zero referência em `app/` ou `pages/`** — nenhuma rota/cron chama o kernel; código funcional e inerte |
| `agent-os-phase-3-product-agents` (Fase 3) | 194 | **PARTIAL** | 14 módulos de agente (`lib/agent-engine/product-agents/`) com validators determinísticos reais + wiring no kernel, testes substantivos (`agent-product-kernel-wiring.test.ts`). Mas **sem chamada de LLM e sem endpoint** — só scaffolding/contrato, nenhum agente roda de verdade |
| `agent-os-phase-4-shadow-evals` (+ `-planning`, ancestral direta) | 233 / 195 | **PARTIAL** | Infra de shadow-eval real (`lib/agent-engine/evals/`: runner, quality-judge, sampler, métricas) com ~14 arquivos de teste. A própria branch declara o critério de aceite real ("≥20 casos históricos por agente") como **"HISTORICAL PRODUCTION EVIDENCE NOT YET APPLICABLE"** — o CRM ainda não tem histórico suficiente pra avaliar de verdade |
| `agent-os-phase-5-assisted-autonomy` | 203 | **PARTIAL** | Autonomia real: kill-switch em cascata, máquina de estados de aprovação, escada de promoção (`off → shadow → draft → assisted → autopilot_*`) que nega auto-promoção pelo próprio modelo. Evidência honesta: o próprio doc admite rodar só localmente ("no GitHub Actions and no Vercel Preview deployment were used"), nunca em CI/ambiente compartilhado |
| `agent-os-phase-5-verification` | 164 | **✅ apagada (§9.4)** | Confirmado: mesmo commit exato de `agent-os-phase-2-kernel` (`8ff7c402`). Alias morto, sem trabalho próprio |
| `agent-os-phase-6-learning-flywheel` | 278 | **PARTIAL** | Flywheel real e testado (`lib/agent-engine/flywheel/*`, 17 arquivos de teste). **Colisão confirmada e não-trivial** com o Flywheel já mergeado em `main` (Fase 10, `docs/current-state.md` §2): ambos leem/escrevem `flywheel_distiller_proposals`, e a migration desta branch reabre a mesma `check constraint` que `main` já alterou duas vezes por outro caminho. Migration nunca rodou contra banco real. Sem flag em `ai_platform_feature_flags` |
| `agent-os-verification` | 252 | **PARTIAL** | Não é fase isolada — é a branch "transporte" cumulativa das fases 1–6 (ver achado estrutural acima). O marcador específico de "Fase 6 verificada" é um commit de 3 linhas sem output de comando anexado — self-report puro para esse ponto específico, ainda que fases anteriores (1/1.5/1.6) tenham evidência mais concreta na mesma árvore |
| `agent-os-phase-7-durable-benchmark-planning` | 111 | **✅ apagada (§9.4)** | Só design doc + 1 teste propositalmente falhando (RED puro, `tests/unit/durable-benchmark-contracts.test.ts` importa um módulo que não existe nesta branch). Era ancestral direta de `agent-os-phase-7-durable-benchmark` (mantida — §9.2), que tem a implementação de verdade |

**Padrão geral:** diferente do pior caso já visto nesta investigação (flag ligada em produção
sem rota nenhuma por trás — ver o achado da outra sessão sobre Fases 9/14 no §9.2), o padrão
aqui é **engenharia real, testada localmente, nunca integrada** — nenhuma rota de produção
chama esse código, nenhuma passou por CI, uma delas (Fase 6) colide de fato com algo que já
está em produção. Decisão do dono do repo: manter as 8 branches como estão por enquanto
(R&D válido, mas nenhuma pronta pra virar PR sem rebase + trabalho de integração real).

---

## 10. GitHub Actions desabilitado (decisão permanente, 2026-08-20)

Gatilho: os checks de CI do PR #25 vieram todos `FAILURE` em 4 segundos — tempo rápido demais
pra falha de teste real. Investigado via `gh run view --repo trydavidqix/CRM`: a anotação real
era `"The job was not started because recent account payments have failed or your spending
limit needs to be increased"` — billing da conta GitHub quebrado, não código. **Isso também
lança dúvida retroativa sobre os PRs #21 e #24, fechados horas antes com "checks falhando"
como justificativa** — pode ter sido o mesmo problema de billing, não falha real de teste; não
foi reaberto porque o conteúdo de ambos (dependency bumps major com breaking changes) já era
descartável por outros motivos, mas o veredito "falhou no CI" especificamente não deve ser
tratado como confiável para decisões anteriores a esta data.

Decisão do dono do repo, dado o cenário: **desabilitar GitHub Actions inteiro,
permanentemente** — não só até resolver o billing. Aplicado via
`PUT repos/trydavidqix/CRM/actions/permissions {"enabled": false}` (configuração de repositório,
não arquivo — continua valendo mesmo se `ci.yml`/`e2e.yml`/`perf.yml`/`publish-image.yml` forem
editados ou um workflow novo for adicionado). Verificado via `GET` do mesmo endpoint:
`{"enabled": false}`.

**Consequências documentadas nesta sessão:**

- `docs/runbooks/deploy.md` reescrito: o caminho que era "exceção" (build direto na VPS) virou
  o único caminho — `publish-image.yml` não publica mais imagem no GHCR automaticamente.
- `.claude/rules/testing-verification.md` ganhou seção própria: verificação local
  (`typecheck`/`lint`/`test:unit`/`test:db` quando aplicável) e Vercel Preview passam a ser a
  prova primária, não complemento ao CI.
- Nova política de cadência, também registrada em `.claude/rules/testing-verification.md`:
  tarefa com subtasks só dispara Vercel Preview na última etapa, não a cada subtask — reforça a
  política pré-existente sobre a cota de 100 previews/24h, agora sem CI cobrindo builds
  intermediários.

**Não investigado nesta sessão:** a causa raiz do billing quebrado (forma de pagamento
vencida, limite de gasto atingido, etc.) — é ação de conta que só o dono resolve em
Settings → Billing & plans do GitHub, e ficou sem efeito prático já que a decisão foi desligar
Actions em vez de consertar o billing.

---

## 11. Voz open-source para linhas europeias — estado em 2026-08-29

**Atualização 2026-08-29 — Voice Core integrado em `codex/crm-consolidated` (merge local, não
enviado a origin).** A branch candidata `codex/voice-media-integration` (276 commits, 234
arquivos — superset confirmado por `git patch-id` das outras 7 branches candidatas do mesmo dia/
autor: `voice-architecture-audit`, `voice-crm-config`, `voice-media-bridge`,
`voice-pipecat-runtime`, `voice-qa-ops`, `voice-security-tests`, `voice-stt-tts`) foi trazida com
`git merge --no-ff` para `codex/crm-consolidated` em `6f6232a2`, sem conflitos. `lib/voice/**` e o
código de sinalização SIP/BYOC descritos abaixo agora existem de fato nesta branch — o parágrafo
seguinte, que descrevia a ausência desses arquivos, está desatualizado pela merge e mantido só como
histórico do estado pré-merge.

Três correções pós-merge aplicadas (não é código novo de feature, é reparo do que a merge expôs):
- `app/app/settings/tenant/voice/_form.tsx`: erro de sintaxe TS real (um `)}` órfão) que quebrava
  `pnpm typecheck`.
- `lib/voice/sip/testing/fake-ari-server.ts`: 1 warning de eslint (`consistent-type-imports`).
- `vitest.config.ts`: bug real de infraestrutura de teste, independente da feature de voz — os
  padrões de `exclude` (`tests/e2e/**` etc.) não tinham prefixo `**/`, então só casavam a partir da
  raiz do repo e não alcançavam as 10 worktrees git aninhadas (`.worktrees/*`, `.claude/worktrees/*`)
  que também são checkouts completos do repo. O vitest coletava e tentava rodar specs Playwright de
  até 10 worktrees, multiplicando o tempo de coleta/execução em ~10x e travando `pnpm test:unit`.
  Corrigido adicionando `"**/.worktrees/**"` e `"**/.claude/worktrees/**"` ao `exclude`.

**Gap real ainda aberto, não corrigido — viola a "regra da tripla" de `CLAUDE.md`:**
`supabase/baseline.sql` não tem o apêndice idempotente para as migrations de voz trazidas pela
merge (`voice_calls`, `voice_phone_numbers`, `voice_sip_connections`); confirmado por
`tests/unit/manifest-x-migrations.test.ts` falhando ("toda migration tem linha no MANIFEST",
"nenhum número de migration é usado duas vezes") numa execução parcial. Um self-hoster que aplicar
`baseline.sql` do zero não vai ter essas tabelas. Também apareceu 1 falha em
`tests/unit/navegacao-completude.test.ts` ("toda tela tem porta"), sugerindo uma tela nova de voice
sem entrada em `lib/navigation/registry.ts`. **Nenhum dos dois foi corrigido ainda.**

**`pnpm test:unit` completo pós-merge: resultado confirmado, rodado no ambiente cloud do Codex**
(tentativas locais no Mac do dono, direto e via `Agent{isolation:"remote"}`, esbarraram em
contenção de máquina — carga do sistema chegou a `load average 320+`, e um worktree de agente teve
`node_modules` corrompido por acesso `pnpm` concorrente; a suíte completa foi então rodada num
ambiente genuinamente separado). Resultado: **4150 passaram, 3 testes falharam (em 4 arquivos), 4
pulados**, `exit code 1`, 842,64s.

Falhas confirmadas:

1. `tests/unit/manifest-x-migrations.test.ts` → "toda migration tem linha no MANIFEST": 7
   migrations sem registro no MANIFEST — `0124_customer_memory`, `0126_voice_calls`,
   `0127_voice_hardening`, `0128_voice_phone_numbers`, `0129_voice_worker_endpoints`,
   `0130_voice_worker_endpoint_privileges`, `0131_voice_sip_connections`. Confirma o gap de
   `supabase/baseline.sql`/MANIFEST já suspeitado.
2. Mesmo arquivo → "nenhum número de migration é usado duas vezes": **bug novo, não suspeitado
   antes** — o número `0124` está duplicado entre duas migrations distintas:
   `0124_ai_chunks_embedding_2048` (já existente antes da merge) e `0124_customer_memory` (trazida
   pela merge de voz). Uma das duas precisa ser renumerada.
3. `tests/unit/navegacao-completude.test.ts` → "toda tela tem porta": confirmado — a tela
   `/app/settings/tenant/voice` não está no registro (`lib/navigation/registry.ts`) nem em
   allowlist justificada.
4. `workers/voice-pipecat-runtime/main.test.mjs` e `workers/voice-worker/pending-outbound.test.mjs`
   → **bug novo, não suspeitado antes**: ambos falham ao carregar com `Cannot bundle Node.js
   built-in "node:test"`. Esses arquivos usam o test runner nativo do Node (`node:test`), não o
   vitest, e a suíte `test:unit` está tentando coletá-los/empacotá-los mesmo assim.

**Atualização 2026-08-29 (mesma sessão) — as 4 falhas corrigidas, confirmado em hardware
separado (VPS `lumenva-crm` de produção, via `/opt/test-run/` isolado, node_modules próprio,
apagado ao fim).** Correções: migration `0124_customer_memory` renumerada pra `0132` (mesmo
timestamp, precedente já documentado em `tests/unit/manifest-x-migrations.test.ts` pro caso
`0121`); as 7 migrations de voz + a renumerada registradas em `supabase/baseline.sql` (apêndice
idempotente) e `supabase/migrations/MANIFEST.md`; `/app/settings/tenant/voice` registrada em
`lib/navigation/registry.ts` (grupo "canais", ícone `Phone`); os dois arquivos `node:test`
(`workers/voice-pipecat-runtime/main.test.mjs`, `workers/voice-worker/pending-outbound.test.mjs`)
excluídos do `pnpm test:unit` e movidos pro lugar certo (`node --test` dentro de
`scripts/verify-voice-core.sh`, mesmo padrão já usado pelo irmão deles).

`pnpm test:db` também rodado na VPS (Postgres descartável via Docker, isolado da produção,
apagado ao fim): **75 arquivos, 507 testes passaram, 1 pulado, "test:db verde"** — confirma que o
`baseline.sql` com o apêndice das migrations de voz instala/atualiza limpo e as invariantes de
RLS/multi-tenancy continuam corretas.

Resultado da corrida completa de `pnpm test:unit` na VPS: 4119 passaram, 2 falharam, 585s. As 2 falhas
(`tests/unit/evidencia-citada.test.ts`, `tests/unit/openrouter-alcance.test.ts`) são falso-negativo
ambiental — o `rsync` que levou o código pra VPS excluiu `.git/` de propósito (transferência leve),
e esses dois testes chamam `git ls-files`/`git grep` internamente. Confirmado rodando os mesmos
dois testes localmente (onde `.git` existe): **39/39 passam**. Nenhuma regressão real. CRM de
produção na mesma VPS confirmado saudável antes/depois (`crm.lumenva.pt` respondendo `307`, todos
os containers `healthy`).

**Atualização 2026-08-29 (mesma sessão) — `pnpm gov:verify` 100% verde, achado e corrigido um
segundo bug real de infraestrutura de teste.** Rodando os 7 gates completos numa VPS isolada
(`rsync` pra `/opt/test-run/`, produção intocada), `typecheck` e `gov:verify` deram OOM (heap
insuficiente na VPS de 3.7GB — mesma limitação já documentada, não é regressão). Rodando os
mesmos dois no Mac local (que tem RAM de sobra), `pnpm lint` sozinho reportou **46929 erros**,
completamente destoante do `0 erros` confirmado na VPS minutos antes. Causa raiz: `eslint.config.mjs`
tinha `globalIgnores` cobrindo `.claude/worktrees/` mas **não** `.worktrees/` — a outra pasta de
worktrees paralelas (branches candidatas de voz e outras), presente no Mac do dono mas ausente na
VPS/CI. Mesma classe exata de bug já corrigida em `vitest.config.ts` nesta mesma sessão. Corrigido
adicionando `.worktrees/` ao `globalIgnores`; confirmado depois: `lint` bate exatamente com a VPS
(0 erros, 266 warnings), e `pnpm gov:verify` completo passa limpo (harness:check, typecheck, lint,
lint:channels, lint:tenant-filter, test:unit — 432 arquivos/4153 testes passaram, 4 pulados, 0
falhas).

**Achado à parte, sobre o próprio harness de agentes (não sobre o produto):** nesta sessão ficou
confirmado que tanto `Agent{isolation:"remote"}` quanto o Codex CLI local rodam no MESMO Mac do
dono, não em hardware separado — ambos competiram entre si e com o Mac local, chegando a
`load average` de 300+ antes de a suíte ser movida pra VPS de verdade. Rodar em VPS via `rsync`
pra um diretório isolado (sem tocar nos containers de produção) foi o que efetivamente proveu
hardware separado nesta sessão.

**Atualização 2026-08-29 (fim de sessão) — enviado a `origin`, Preview verde.** Com autorização
explícita do dono ("aprovado e autorizado"), `git push origin codex/crm-consolidated` (fast-forward,
sem divergência): `d8fbc575..a552a512`. A integração GitHub↔Vercel disparou automaticamente um
Preview (`dpl_AHs4qWgkGU2cUN22qGw6j6pepd61`, commit `a552a512`), que terminou `READY` — build
limpo, sem erro. URL: `crm-git-codex-crm-consolidated-lumenva.vercel.app`.

**Atualização 2026-08-30 — endpoint `/stt` novo no sidecar Python da VPS de bench de voz
(`root@2.29.8.225`, `/opt/voice-vps-bench/voice_worker_server_v12.py`, fora do repo/git).**
Antes só existiam `/turn` (STT + resposta OpenAI + TTS, tudo junto) e `/speak` (TTS isolado). Um
STT isolado faltava — sem ele, todo turno pagaria uma chamada OpenAI e uma síntese TTS descartadas
só pra extrair o texto ouvido. Adicionado um branch `elif self.path == '/stt':` em `Handler.do_POST`,
antes do `elif self.path == '/speak':` existente, reaproveitando `ulaw2linear_vec`/
`local_transcribe` (faster-whisper) já presentes no arquivo — puramente aditivo, não reordenou nem
alterou os branches `/turn`/`/speak`/`/play_elevenlabs_test` existentes. O branch `/stt` também
replica o trim de silêncio de cabeça/cauda que `process_turn()` já fazia antes de chamar
`local_transcribe` (mesmo `threshold=200`, mesmo padding de 800 amostras, mesmo fallback de 1600
amostras) — sem isso, `/stt` ficaria mais sujeito a alucinação do STT em padding silencioso do que
`/turn` já era, porque um seria PCM cru e o outro trimado pro mesmo modelo.

Deploy manual (sidecar não é versionado):

```bash
scp -i ~/.ssh/id_ed25519 root@2.29.8.225:/opt/voice-vps-bench/voice_worker_server_v12.py /tmp/voice_worker_server_v12.py
# editar /tmp/voice_worker_server_v12.py (branch /stt + trim de silêncio)
python3 -m py_compile /tmp/voice_worker_server_v12.py   # exit=0
scp -i ~/.ssh/id_ed25519 /tmp/voice_worker_server_v12.py root@2.29.8.225:/opt/voice-vps-bench/voice_worker_server_v12.py
# restart seguro (ver achado abaixo — não usar pkill -f na mesma linha que invoca o script):
ssh -i ~/.ssh/id_ed25519 root@2.29.8.225 "pgrep -f 'venv/bin/python3 voice_worker_server_v12.py'"
ssh -i ~/.ssh/id_ed25519 root@2.29.8.225 "kill <pids-do-passo-anterior>"
ssh -i ~/.ssh/id_ed25519 root@2.29.8.225 "cd /opt/voice-vps-bench && setsid nohup env OPENAI_API_KEY=<REDACTED> INWORLD_API_KEY=<REDACTED> ./venv/bin/python3 voice_worker_server_v12.py > /tmp/worker_v12.log 2>&1 < /dev/null & disown; echo started"
```

**Achado operacional durante o primeiro deploy — `pkill -f voice_worker_server_v12.py` se
auto-matou.** O comando de restart original do plano começava com `pkill -f
voice_worker_server_v12.py; sleep 1; ...`. Como o próprio comando remoto (`bash -c "..."` executado
via `ssh host '<comando>'`) contém a string `voice_worker_server_v12.py` na sua linha de comando (no
`pkill` e no `./venv/bin/python3 voice_worker_server_v12.py` mais adiante), `pkill -f` (que casa
contra a linha de comando completa) matou o próprio processo `bash -c` da sessão SSH antes de ele
chegar no `setsid nohup ...`. Resultado observado: SSH saiu com `exit=255` sem nenhum output, e o
processo antigo morreu sem que um novo subisse — o serviço ficou momentaneamente fora do ar (sem
`/turn`/`/speak`/`/stt` respondendo) até ser percebido e corrigido na mesma sessão. **Padrão de
restart seguro adotado a partir daí** (usado com sucesso no fix do trim, sem repetir o footgun):
`pgrep -f 'venv/bin/python3 voice_worker_server_v12.py'` numa chamada SSH isolada pra achar os PIDs
reais, `kill <pids>` explícito numa segunda chamada, e só então o `setsid nohup ...` de start numa
terceira chamada — nunca `pkill -f <nome-do-script>.py` na mesma linha SSH que também invoca esse
script.

Verificação pós-deploy do `/stt` original (Steps 5–6 do plano, antes do trim):
- `/stt` com 1s de µ-law de silêncio puro: `EXIT=0`, corpo vazio (esperado — silêncio não gera
  transcrição), sem `500`/conexão recusada.
- `/speak` com texto curto: `HTTP=200 SIZE=3901` — sem regressão.
- `/turn` com 2s de µ-law de silêncio: `HTTP=200`, headers `X-Heard`/`X-Reply-Text` presentes,
  corpo de áudio `SIZE=40033` — sem regressão.
- Processo (`pgrep`) estável depois dos três testes, sem traceback em `/tmp/worker_v12.log`.

**Fix round 1 (mesmo dia) — trim de silêncio portado de `process_turn()` pro `/stt`.** Reverificado
depois do deploy do trim, com o restart seguro descrito acima:
- `/stt` com 1s de µ-law de silêncio puro: `EXIT=0`, corpo vazio — sem regressão.
- `/speak` com texto curto: `HTTP=200 SIZE=3809` — sem regressão (variação de tamanho é normal do
  TTS, não indica quebra).
- `/turn` com 2s de µ-law de silêncio: `HTTP=200 SIZE=39579`, headers `X-Heard`/`X-Reply-Text`
  presentes — sem regressão.
- Processo (PID novo, `pgrep`) estável depois dos três testes, sem traceback no log.

Teste com fala real (não só silêncio sintético) fica para a Task 8 do plano (ligação de verdade),
conforme o brief original já previa.

---

Contexto histórico (pré-merge, 2026-08-28) do que segue: nesse snapshot, o checkout `codex/crm-
consolidated` estava em `54e86839486849ad5b14a19851eb1f3696d93605` e não existiam ficheiros
rastreados em `lib/voice/**`, `workers/voice-worker/**` ou `workers/voice-runtime/**` — a voz
SIP/BYOC ainda não estava integrada nesta branch. Existia uma implementação candidata em
`origin/implementacao-tokens-voice-core` em `d3c97cbd8d3ca8ca5616e05f23411e52520a5a3a`, tratada
como trabalho separado até ser comparada, integrada seletivamente e validada no mesmo snapshot do
CRM. (Essa comparação/integração seletiva é exatamente o que a merge acima concluiu.)

### Duas arquiteturas na mesma branch — não são opções concorrentes

A branch candidata contém código de **duas gerações**, não três caminhos em disputa:

1. **Geração antiga (ainda em produção na própria branch candidata):** Telnyx (carrier PSTN pago,
   EUA) + Patter (mídia) + Deepgram (STT pago) + ElevenLabs (TTS pago). Implementada e testada
   localmente, nunca provou chamada PSTN real. LiveKit chegou a ser desenho obrigatório num plano
   ainda mais antigo; hoje é só opcional, reservado a takeover humano pelo navegador — não compete
   com nada.
2. **Geração aprovada em 2026-08-27 pelo dono (a atual, substitui a 1):** Asterisk/ARI (SIP/BYOC,
   número do próprio cliente) + Pipecat + faster-whisper + Piper/Kokoro + OpenVoice — 100%
   open-source, sem vendor pago obrigatório. É esta que os docs abaixo descrevem.

A geração 1 fica como rede de segurança até a 2 provar chamada real de ponta a ponta; não apagar
sem decisão explícita.

### Decisão funcional

O cliente conserva o próprio número. O sistema usa SIP/BYOC para entrar no meio da ligação, sem
comprar ou substituir um número técnico. O cliente poderá escolher idioma europeu, género, voz,
velocidade, tom e estilo. Clonagem é opcional e exige consentimento verificável e revogável.

### Estado de prova — camada de sinalização (controle da chamada)

Confirmado por leitura direta do código em `d3c97cbd` (não é mais scaffold): o "rewire" do
worker de sinalização SIP/BYOC **está feito**. `workers/voice-sip-worker/main.mjs` é entrypoint
de produção real — liga ARI (Asterisk) → validação de tenant local via Postgres →
`AsteriskAriListener` com reconexão automática por backoff → `SipEventForwarder` chamando
`/api/internal/voice/context` e `/event` do CRM por HTTP real. Testado ponta a ponta com
Postgres nativo real, servidor ARI falso (HTTP+WS reais) e HTTP real — não é mock vazio. Na VPS,
o worker rodou isoladamente como serviço de teste, `/healthz` respondeu, ARI real autenticou
(Asterisk 22.5.2, dialplan `voicecore-test`) e a suíte Voice passou com 43 ficheiros/199 testes.

**O que falta não é mais "religar o worker"; são duas lacunas de infraestrutura:**

- **Áudio de IA: benchmark CPU concluído em dois hosts — Colab e a própria VPS de produção.**
  Colab (`2026.07`, Python `3.12.13`, CPU-only, ~12.67 GiB RAM, ~113.94 GiB disco), áudio de
  ~10s: `faster-whisper tiny` `1.585650–1.644854 s`/`11.308125 s`; Piper
  `3.827799–4.718331 s`/`11.064–11.308 s`; Kokoro `21.044665–21.571024 s`/`10.5 s` (carregamento
  `6.503924 s`). Ver
  [`docs/evidence/voice-colab-cpu-benchmark-2026-08-28.md`](evidence/voice-colab-cpu-benchmark-2026-08-28.md).
  **Reteste na VPS real (`lumenva-crm`, AMD EPYC-Genoa, 2 vCPU, 3.7GB total) em 2026-08-28, com
  autorização explícita do dono, containers de produção parados durante o teste e religados
  depois (saúde confirmada: 11/11 `healthy`, `https://crm.lumenva.pt/` respondeu `307`):**
  `faster-whisper` `1.009–1.055 s`/`13.86 s` (RTF ≈ `0.07–0.08`); Piper `0.958–1.027 s`/`13.86–14.09 s`
  (RTF ≈ `0.07`) — **bem mais rápido que no Colab**, apesar de a VPS ter ~1/4 da RAM. **Kokoro
  também foi testado na VPS**, numa segunda passagem, usando um container Docker descartável
  `python:3.12-slim` (`docker run --rm`, sem instalar nada permanente no sistema) já que
  `kokoro==0.9.4` exige Python `<3.13` e a VPS só tem `3.14` via apt: RTF `0.497–0.717` — **reverte
  o `FAIL` do Colab (RTF ~2.0)**, carregamento do modelo `20.28s` (inclui overhead de container +
  download, não isolado). Ver
  [`docs/evidence/voice-vps-cpu-benchmark-2026-08-28.md`](evidence/voice-vps-cpu-benchmark-2026-08-28.md).
  **Teste de carga concorrente (2026-08-28, mesma sessão, a pedido do dono):** os três motores
  rodaram **ao mesmo tempo** (não sequencial), **com o CRM inteiro ligado e saudável** (não
  parado desta vez). RTF sob carga: Piper `0.127–0.207`; faster-whisper `0.144–0.242`; Kokoro
  `0.590–0.860` — todos continuam abaixo de `1.0` (tempo real), 2-3x mais lento que isolado mas
  sem reprovar. `crm.lumenva.pt` respondeu `307` o tempo todo (`0.63s` antes, `1.70s` no pico de
  carga, `0.39s` depois) — ficou mais lento, não caiu; nenhum dos 11 containers reiniciou/morreu.
  Swap chegou a `2.3GB` de `4GB` configurados — a caixa se apoiou pesado em swap, não só RAM.
  **O que esse teste ainda NÃO prova:** o Asterisk/Pipecat de verdade não estava rodando junto
  (só simula pressão CPU/RAM, não o pipeline de voz real), não é streaming/chunks, não é múltiplas
  chamadas simultâneas, e o teste durou segundos, não uma ligação de minutos sob a mesma pressão.
  Antes de decidir host de produção definitivo, ainda falta testar essas condições.
- **Deploy do Asterisk não está versionado.** A instância na VPS foi configurada manualmente,
  fora do Git — não existe `pjsip.conf`/`extensions.conf`/unidade systemd capturados no repo.
  Escrever essa receita "de memória" arrisca divergir do que já roda na VPS; a via seleccionada
  é extrair a config real da VPS primeiro (ver handoff novo abaixo) e só depois versionar.

O gate completo (`bash scripts/verify-voice-core.sh`) ficou `NOT_PROVEN` no último snapshot
porque `pnpm typecheck` esgotou o heap do runner — não é reprovação do código, é limite do
runner. Há prova isolada de áudio de IA em CPU no sandbox Colab, mas ainda não há prova de
chamada PSTN/SIP completa, integração Asterisk↔Pipecat, streaming, transferência, latência
ponta a ponta, custo ou voz clonada em produção. O schema Voice foi aplicado no banco usado pela VPS após
autorização explícita; isso não significa que a branch consolidada recebeu o código nem que
produção está ativada.

**Atualização 2026-08-28 (noite, mesma sessão) — primeira chamada real de ponta a ponta,
prova de conceito fora do repo.** Com autorização explícita do dono, um script ad-hoc (não
commitado, vive só em `/opt/voice-vps-bench/` na VPS) provou pela primeira vez o caminho
completo numa ligação real: softphone registrado no Asterisk real → ponte de áudio RTP → STT
(`faster-whisper`) → resposta → TTS (Piper) → volta ao telefone. **O dono ouviu a resposta
sintetizada, ao vivo, numa chamada real.** 6 bugs reais foram encontrados e corrigidos no
caminho (loop de canais fantasma, RTP simétrico não aprendendo o destino, ordem de bytes,
formato `slin` sem negociação causando ruído puro — corrigido trocando pra `ulaw` padrão,
buffer de jitter quebrado por pacotes descontínuos, cabeçalho HTTP corrompendo acento). Latência
final ~5-8s por turno (modelos carregados uma vez, não por chamada). Pendências reais que
sobraram: voz sintetizada soa "robótica" (provável teto de qualidade de 8kHz + voz medium do
Piper), sem integração com Agent OS (é só eco/confirmação), sem detecção real de fim de fala.
Todos os processos de teste foram parados ao fim da sessão; CRM confirmado saudável, intocado por
esta parte. Detalhe completo, bug a bug:
[`docs/evidence/voice-vps-real-call-bridge-2026-08-28.md`](evidence/voice-vps-real-call-bridge-2026-08-28.md).

**Atualização 2026-08-29 (mesma sessão seguinte) — alucinação/repetição da transcrição
corrigida.** Filtro de pós-processamento (`is_repetition_garbage()`) descarta texto quando uma
palavra domina ≥40% ou a proporção de palavras únicas cai abaixo de 60% — validado contra os 4
casos reais de alucinação vistos, 0 falsos positivos em 8 casos de teste. Confirmado ao vivo:
nova chamada retornou frase coerente, sem repetição.

**Atualização 2026-08-29 (mesma sessão seguinte) — qualidade da voz melhorada substancialmente
(8,5/10, avaliação ao vivo do dono).** Achado real, não cosmético: a voz usada era **português
do Brasil** (`pt_BR-*`), mas a Lumenva é operação **portuguesa**. Trocado para
`pt_PT-tugão-medium`, a única voz europeia disponível no Piper (masculina — não existe pt-PT
feminino ainda; saudação ajustada de "Karol" pra "Tó"). Velocidade ajustada via `length_scale`
até `1.4` (testado 1.0→1.03→1.25→1.4, cada um avaliado ao vivo). Kokoro foi testado como TTS
principal nesta ponte (não só benchmark isolado) — mesma avaliação de "robótica" que o Piper e
mais lento, então não substituiu. **Nova feature, fora do escopo original: saudação proativa** —
ao atender, a ponte fala primeiro ("Bom dia, meu nome é Tó...") antes de esperar o interlocutor,
via novo endpoint `/speak`. Detalhe completo na mesma evidência.

**Atualização 2026-08-29 (sessão seguinte) — exposição do Asterisk mitigada.** O log de
mensagens tinha crescido de 5,3GB pra 15,6GB durante a noite (bots continuaram varrendo);
rotacionado e arquivo antigo apagado, `logrotate` configurado pra nunca mais crescer sem
controle. `fail2ban` instalado com filtro próprio pro formato `res_pjsip` do Asterisk 22 (o
filtro padrão do fail2ban é pra `chan_sip`, formato antigo, não batia) — testado contra 126 mil
linhas reais do log antes de ativar. Ativo, confirmado banindo IPs atacantes automaticamente
(5 IPs banidos nos primeiros minutos), sem afetar o endpoint de teste nem o CRM. Não foi usada
allowlist fixa de IP porque o celular do dono usa rede móvel com IP dinâmico. Detalhe na mesma
evidência acima.

**Atualização 2026-08-29 (sessão seguinte) — dois bugs reais de áudio achados/corrigidos;
sentido celular→servidor continua quebrado.** Pesquisa de alternativas de TTS pago (ElevenLabs
10/10 mas reverte decisão open-source; XTTS-v2/F5-TTS tecnicamente melhores mas sem licença
comercial disponível; Chatterbox/StyleTTS2 sem bom português; Inworld AI promissor mas não
testado; OpenAI `gpt-4o-mini-tts` testado com conta já existente do dono). Durante o teste do
OpenAI TTS numa chamada real, o celular ficou "mudo" — investigação com `rtp set debug`/
`pjsip set logger` ativos numa chamada real (não visível no self-test local) achou o Asterisk
mandando RTP pro **IP privado (Wi-Fi local) do celular**, não pro IP público real. Corrigido com
`rtp_symmetric=yes`/`rewrite_contact=yes`/`force_rport=yes` em `/etc/asterisk/pjsip.conf`;
confirmado corrigido no sentido servidor→celular via dados móveis. **Sentido celular→servidor
continua sem funcionar** (`Got RTP` = 0 em toda chamada testada depois do fix) — bloqueador
aberto, não investigado a fundo ainda. Segundo bug: o áudio de teste do OpenAI tocou "lento"
porque a conversão pra µ-law presumiu 24kHz sem verificar (documentação da OpenAI diz 24kHz é o
padrão, mas o arquivo local já estava a 8kHz); diagnosticado sem custo de API rodando o mesmo PCM
pelo faster-whisper em 5 taxas candidatas e comparando qual transcrição fazia sentido —
corrigido revertendo pra conversão direta sem resample, confirmado ao vivo. Processos da ponte
deixados rodando na VPS ao fim desta sessão (decisão consciente, pra não perder estado antes de
investigar o bug de entrada de áudio). Detalhe completo:
[`docs/evidence/voice-vps-real-call-bridge-2026-08-28.md`](evidence/voice-vps-real-call-bridge-2026-08-28.md).

**Atualização 2026-08-29 (sessão seguinte) — tentativa de migração pra Pipecat +
`pipecat-asterisk` pausada, não concluída.** Motivada pela latência arquitetural (5-9s) do teste
full-stack OpenAI acima. Compilado Asterisk 22.11.0 oficial (fonte — Ubuntu só tem 22.5.2, sem o
módulo `chan_websocket`) numa instalação isolada em `/opt/asterisk-v2/` (porta 5061), sem tocar
na instância de produção (porta 5060). Regra de firewall nova no Hetzner Cloud Firewall (UDP
5061 — firewall de nuvem separado do `iptables` do SO). Pipeline Pipecat + `OpenAIRealtimeLLMService`
montada; conexão com a OpenAI confirmada funcionando (session.created chega). **Bloqueador real
não resolvido**: o áudio do celular nunca chega no Asterisk-v2, mesmo com sinalização/registro
ok e mesmo celular/rede que funcionam sem problema na instância antiga — confirmado por
instrumentação direta no código da biblioteca e por teste de isolamento com `Record()` puro
(sem Pipecat). Mais de 3 correções tentadas (ICE, rtp.conf, faixa de porta, dialplan) sem
resolver — seguindo a skill `systematic-debugging`, pausado por decisão do dono em vez de
insistir mais. Processos parados, instalação preservada pra retomar depois. A instância antiga
(porta 5060) **continua intocada e é o único caminho comprovado funcionando**. Detalhe completo:
[`docs/handoffs/HANDOFF-voice-sip-2026-08-28.md`](handoffs/HANDOFF-voice-sip-2026-08-28.md).

**Veredito:** `SINALIZAÇÃO SIP/BYOC IMPLEMENTADA E TESTADA (PROVIDER-FREE) NO REF CANDIDATO /
FASTER-WHISPER, PIPER E KOKORO VIÁVEIS EM CPU NA VPS REAL, ISOLADO E SOB CARGA CONCORRENTE COM O
CRM LIGADO / PRIMEIRA CHAMADA REAL DE PONTA A PONTA PROVADA COM SCRIPT AD-HOC FORA DO REPO
(NÃO É O VOICE CORE DO REPOSITÓRIO, NÃO É PRODUÇÃO) / DEPLOY DO ASTERISK VERSIONADO EM
`ops/voice-asterisk/` / EXPOSIÇÃO DO ASTERISK A BRUTE-FORCE MITIGADA (FAIL2BAN + LOGROTATE) /
MIGRAÇÃO PRA PIPECAT+CHAN_WEBSOCKET TENTADA E PAUSADA (ÁUDIO CELULAR→ASTERISK-V2 NÃO FLUI,
CAUSA RAIZ NÃO ISOLADA) / **INTEGRADO EM `codex/crm-consolidated` VIA MERGE LOCAL (`6f6232a2`,
2026-08-29) / OS 4 GAPS ACHADOS POR `pnpm test:unit` (BASELINE/MANIFEST SEM 7 MIGRATIONS DE VOZ,
NÚMERO `0124` DUPLICADO, TELA `/app/settings/tenant/voice` SEM NAVEGAÇÃO, DOIS TESTES `node:test`
QUEBRANDO O VITEST) MAIS UM BUG DE INFRA ACHADO DEPOIS (`eslint.config.mjs` SEM `.worktrees/` NO
`globalIgnores`) FORAM TODOS CORRIGIDOS / `pnpm gov:verify` COMPLETO VERDE (harness:check,
typecheck, lint 0 erros, lint:channels, lint:tenant-filter, test:unit 432 arquivos/4153
testes/0 falhas) / `pnpm test:db` VERDE (507 testes/75 arquivos) / ENVIADO A `origin`
(`d8fbc575..a552a512`, autorização explícita do dono) / VERCEL PREVIEW `READY`**.

Próxima ação e detalhe de execução: [`docs/handoffs/HANDOFF-voice-vps-config-2026-08-28.md`](handoffs/HANDOFF-voice-vps-config-2026-08-28.md).
Referência resumida: [`docs/voice/open-source-europe.md`](voice/open-source-europe.md).

### Atualização 2026-08-30 — unificação SIP/BYOC + Agent OS real, deploy em produção, primeira ligação real pós-merge (EM ANDAMENTO, sem áudio ainda)

**Contexto.** Spec/plano dedicados escritos e executados via `subagent-driven-development` nesta
sessão: [`docs/superpowers/specs/2026-08-29-voice-unify-sip-worker-media-design.md`](superpowers/specs/2026-08-29-voice-unify-sip-worker-media-design.md)
e [`docs/superpowers/plans/2026-08-29-voice-unify-sip-worker-media.md`](superpowers/plans/2026-08-29-voice-unify-sip-worker-media.md).
Objetivo: unificar dois pedaços até então desconectados — (1) o worker de sinalização SIP/BYOC +
ponte RTP + turn-service do Agent OS real do repo, testados só isoladamente, nunca ligados entre
si; (2) o script ad-hoc Python que tinha provado uma ligação real em 2026-08-28 (§ acima) mas sem
nenhum código do produto real (sem tenant, sem Agent OS).

**Tasks 1–7 do plano: CONCLUÍDAS, revisadas (task-reviewer + fix loop) e commitadas.** Adapter
STT/TTS em modo batch reaproveitando o sidecar existente (`lib/voice/media/sidecar-speech-adapter.ts`),
parser/builder RTP (`lib/voice/media/rtp-frame.ts`), sender contínuo com preenchimento de silêncio
(`lib/voice/media/continuous-sender.ts`), `SipBrainClient.runTurn()` chamando o turn-service real
via `/api/internal/voice/turn`, e fiação completa dentro de `workers/voice-sip-worker/main.mjs`
(`attachMedia()`). Dois bugs reais achados pelo review e corrigidos antes do merge: gap de
segurança na SQL de `/api/internal/voice/turn` (não verificava `verified`/`enabled` da conexão SIP
asterisk) e um bug de perda de pacote RTP (`Promise.race` numa iterator compartilhado abandonava o
resolver perdedor no FIFO interno da sessão, roubando o pacote real do turno seguinte) — trocado por
um único consumidor `for await` contínuo pra a chamada inteira. Detalhe task a task no ledger SDD
(`.superpowers/sdd/2026-08-29-voice-unify-sip-worker-media/progress.md`, git-ignorado).

**Merge pra `main` e deploy real em produção — autorizado explicitamente pelo dono.** Todo o
trabalho acima (mais os commits já citados neste documento) foi mergeado
`codex/voice-unify-media-2026-08-29` → `codex/crm-consolidated` → `main`, enviado a `origin`, e a
VPS de produção (`crm.lumenva.pt`) atualizada e reconstruída. Isso exigiu resolver, em cadeia, três
bugs de infraestrutura pré-existentes e não relacionados a voz, nunca antes achados porque **o
build Docker local nunca tinha sido exercitado de verdade** (deploy sempre puxou imagem pronta do
GHCR via GitHub Actions; Actions está desabilitado desde 2026-08-20 — ver §10 — então o build
ad-hoc documentado no runbook virou, pela primeira vez, o único caminho real):

1. **`pnpm build` rodando `test:unit` sob `NODE_ENV=production`** (commit `5dc1b23c`). O Dockerfile
   seta `NODE_ENV=production` antes de `RUN pnpm build`; `test:unit` roda antes de `next build`
   dentro desse mesmo script, então nunca ganha a folga que `lib/env.ts` só dá quando
   `NEXT_PHASE=phase-production-build` (flag que só existe dentro do `next build`). Com
   `NODE_ENV=production` já valendo, toda var `required()` em `lib/env.ts` exigia valor real — e
   também o Vitest muda resolução de módulo builtin sob production e quebrava com `Error: No such
   built-in module: node:`. Reproduzido e confirmado localmente
   (`NODE_ENV=production npx vitest run lib/utils.test.ts`) antes do fix. Corrigido fazendo
   `pnpm build` rodar `test:unit` explicitamente sob `NODE_ENV=test`. Um patch anterior (`aaa9e17a`,
   revertido) tinha tentado só adicionar placeholders pras vars — sintoma, não raiz; descartado.
2. **7 testes de introspecção do próprio repo incompatíveis com o contexto de build Docker**
   (commits `db14ee57`, `6f8cfcf2`): `env-example-sync`, `openrouter-alcance` (2 testes),
   `voice-qa-harness-contract`, `e2e-workflow-honra-o-env`, `evidencia-citada`,
   `n8n-inbound-contract`, `n8n-reference-workflow` — todos leem `.env.example`/`docs/`/`.git`/
   `playwright.config.ts`, que `.dockerignore` corta de propósito do contexto de build (segredo/
   tamanho). Novo script `test:unit:docker-build` (exclui só esses 7) e `build:docker`, usados só
   pelo Dockerfile; `pnpm build`/`pnpm test:unit` locais e no Vercel continuam intactos, os 7 testes
   seguem valendo lá onde `.git`/`docs`/`.env.example` existem de verdade.
3. **`voice_calls_provider_check`/`voice_call_events_provider_check` nunca ampliados pra
   `asterisk`** (migration `20260830190000_0133_voice_calls_provider_asterisk.sql`, commit
   `777adb35`, aplicada em produção). `0131_voice_sip_connections` tinha ampliado só
   `voice_phone_numbers_provider_check` — as outras duas, fechadas em `0127_voice_hardening` só com
   `'telnyx'`, ficaram esquecidas. `/api/internal/voice/context` rejeitava o insert com erro cru de
   Postgres, sanitizado pela rota pra mensagem genérica (`voice_context_failed` sem detalhe) — só
   achado ao vivo, na primeira ligação real, lendo o erro real via `psql \d voice_calls`. A linha da
   `0127` no `MANIFEST.md` estava incorreta (dizia que a `0131` já tinha ampliado essas duas) e foi
   corrigida junto.

Build Docker local confirmado verde depois dos 3 fixes: `429/429` arquivos de teste, `4077
passed | 4 skipped`, lint limpo, `next build` compilado. Imagem `deskcomm-app:local` reconstruída
e subida (`docker compose ... up -d app` com `APP_PULL_POLICY=never`, runbook padrão). Pós-deploy
confirmado: `https://crm.lumenva.pt/` responde `307`, container `deskcommcrm-app-1` `healthy`,
`/api/internal/voice/context`/`/api/internal/voice/turn` deixaram de dar `404` (passaram a `405`
em GET, ou seja: as rotas existem agora, só rejeitam o verbo errado).

**Worker SIP real subido apontado pra produção real (`https://crm.lumenva.pt`), fora do repo
versionado** (`/opt/voice-prod-run/repo`, clone local a partir de `/root/deskcommcrm`, `main`
atual; roda via `tsx workers/voice-sip-worker/main.mjs`, porta `8091`). Sidecar STT/TTS
(`voice_worker_server_v12.py`, § acima) religado em `127.0.0.1:8500`. Org real usada: Lumenva
(`2e51006a-b264-48d1-8011-a33aecbdb311`, ver [[project_lumenva_identity]] na memória), número
`+351910293287`, `voice_sip_connections`/`voice_phone_numbers` inseridos em produção
(`external_connection_id='lumenva-asterisk-byoc'`).

**Quatro bugs reais achados e corrigidos ao vivo, ligação após ligação, um por vez, cada um só
depois de ler log/fonte real (nunca chute) — nesta ordem:**

1. `ARI_BASE_URL` configurado com `/ari` no fim (`http://127.0.0.1:8088/ari`) quando
   `AsteriskAriConfig.baseUrl` já espera sem o sufixo — toda chamada ARI virava `/ari/ari/...`,
   sempre `404`, não importa o canal. Erro de configuração da sessão (env var passada errada ao
   iniciar o worker), não bug de código — corrigido restartando o worker com o valor certo.
2. `voice_calls_provider_check`/`voice_call_events_provider_check` fechados em `'telnyx'` — item 3
   da lista de infra acima, migration `0133`.
3. **`asterisk-adapter.ts` passava `event.timestamp` cru do Asterisk (formato `+0000`, sem
   dois-pontos) pro campo `occurred_at`, que `/api/internal/voice/event` valida com Zod
   `.string().datetime()` estrito (só aceita `Z` ou `+00:00`)** — confirmado com
   `z.string().datetime().safeParse('...+0000')` retornando `false` localmente antes do fix.
   `recordEvent()` falhava com `validation_failed` toda ligação, matando o turno silenciosamente.
   Corrigido normalizando na borda: `occurredAt: new Date(event.timestamp).toISOString()`
   (commit `0484257b`). Teste unitário do arquivo (`asterisk-adapter.test.ts`, 11 testes) continua
   verde depois do fix.
4. **Aberto, não investigado ainda — sessão parada aqui a pedido explícito do dono ("Pare de
   alterar. Atualize toda a documentação.").** Depois do fix #3, a chamada seguinte passou dos
   erros anteriores e falhou com `voice_sip_event_forward_failed` / `SIP brain request failed:
   http_500` — um erro 500 genuíno em `/api/internal/voice/context` ou `/api/internal/voice/event`
   em produção, causa raiz ainda não lida (nem no log do worker, que só vê o código HTTP, nem no
   log do container `deskcommcrm-app-1`, que voltou vazio pros últimos minutos testados — precisa
   investigar onde o logger estruturado da rota realmente escreve/se o Sentry capturou algo).
   **Toda ligação de teste até agora terminou em silêncio total (0 áudio ouvido pelo dono)** —
   nenhum turno de Agent OS chegou a rodar de ponta a ponta ainda nesta sessão.

**Bugs #5 e #6 (mesma sessão, continuação) — dois erros reais empilhados em
`app/api/internal/voice/event/route.ts`, achados reproduzindo o `http_500` direto com `curl`
contra produção (não é mock: o mesmo payload que o worker manda).** Commit `3af01c58` +
`872a4a63`:
- **#5:** `INSERT INTO voice_call_events` usava a coluna `payload`, renomeada pra `attributes`
  pela migration `0127` (2026-08-26) — `column payload does not exist`, exceção não tratada (a
  rota não tem `try/catch` ali), 500 puro sem corpo. Junto: `provider = 'lumenva'` hardcoded em 3
  lugares (não é provider válido, viola `voice_call_events_provider_check`) — corrigido derivando
  o provider real (`technical_phone_e164` presente ⇒ `telnyx`, senão `asterisk`), mesma lógica que
  o resto da rota já usa.
- **#6:** depois de corrigir #5, nova falha: Postgres `42P08 could not determine data type of
  parameter $6` — `$6` (`provider_call_id`) só aparecia em contextos sem tipo explícito o bastante
  (`coalesce(...)`/`IS NULL`). Reproduzido e confirmado com `PREPARE` direto no Postgres real antes
  do fix; corrigido com cast `$6::text` nos dois usos ambíguos. Um teste de contrato
  (`voice-worker-tenant-binding-contract.test.ts`) batia string literal no SQL da rota e precisou
  ser atualizado pro texto novo — achado pelo próprio gate no build Docker seguinte.

**Bug #7 (real, mas fora do CRM) — worker subido sem `VOICE_MEDIA_EXTERNAL_HOST`.** Sem essa var
`mediaEnabled=false` e `attachMedia()` retorna sem fazer nada — a ponte de áudio inteira nunca
rodou o dia inteiro, mesmo com todos os bugs #1-#6 corrigidos. Corrigido subindo o worker com
`VOICE_MEDIA_EXTERNAL_HOST=2.29.8.225`.

**Bug #8 (real, camada de rede, fora do código do produto) — firewall de nuvem da Hetzner sem
regra pra faixa RTP.** Com a mídia habilitada, a próxima ligação criou a ponte RTP real
(`UnicastRTP` via ARI `externalMedia`) mas `rxcount=0` nos dois lados — zero pacotes RTP recebidos
pelo Asterisk, confirmado com `tcpdump` direto na placa de rede (não só no Asterisk) em dois testes
de rede diferentes (dados móveis e Wi-Fi), 60s cada, 0 pacotes capturados em toda a faixa
`10000-20000`. Isolou o problema pra ANTES do próprio SO da VPS. No painel da Hetzner
(`console.hetzner.com`, projeto Lumenva, firewall `lumenva-crm-firewall`), as 7 regras existentes
cobriam TCP 22/80/443, ICMP, UDP 5060/5061/8000-8100 — nenhuma cobria a faixa RTP real
(`rtp.conf`: `rtpstart=10000`/`rtpend=20000`). Adicionada regra INBOUND UDP 10000-20000 (Any
IPv4/IPv6) com autorização explícita do dono antes de salvar (ação feita via `claude-in-chrome` na
sessão de browser já logada do dono, sem o agente ver/inserir credencial).

**Ligação real funcionou — áudio confirmado pelo dono ao vivo, 2026-08-30 ~21:47 UTC.** Log do
worker: ~25s de chamada, zero eventos de erro (`voice_sip_event_forward_failed`,
`voice_media_attach_failed`, `voice_media_turn_failed` — nenhum apareceu). Debug do Asterisk
(`rtp set debug`, `pjsip set logger`, canal `full.log` temporário em `logger.conf`) desligado e
revertido logo depois (`logger.conf` original restaurado, backup timestamped deixado ao lado).

**Ajuste de latência (mesma sessão, depois da 1ª ligação com sucesso).** `VOICE_MEDIA_LISTEN_MS`
(janela FIXA de espera antes de processar o áudio bufferizado — não é detecção de silêncio/VAD)
estava no default de `4000`ms. Primeira ligação: agente começou a falar em ~10s. Reduzido pra
`1500`ms → ~7s. Reduzido de novo pra `800`ms (valor atual, worker rodando com ele) → esperado
~6s, ainda não confirmado numa ligação depois desse último ajuste. A janela contribui quase 1:1 pro
atraso total; o resto (~5.5-6s) é STT + turno do Agent OS + TTS em série — não muda ajustando essa
var. **~5.5-6s é o piso realista da arquitetura atual (sem streaming/VAD real)**; baixar a janela
mais perto de zero arrisca cortar o áudio antes do interlocutor terminar de falar. Reduzir esse piso
de verdade é trabalho de arquitetura (streaming incremental), não config — fica pra sessão futura,
não é bug.

**Processos deixados rodando na VPS ao fim desta sessão (decisão consciente, inclusive pra
continuar o teste de latência amanhã):** worker SIP (`/opt/voice-prod-run/repo`, `tsx
workers/voice-sip-worker/main.mjs`, porta `8091`, `VOICE_MEDIA_EXTERNAL_HOST=2.29.8.225`,
`VOICE_MEDIA_LISTEN_MS=800`) e sidecar STT/TTS (`voice_worker_server_v12.py`, porta `8500`).
Nenhum dos dois é serviço systemd — processo solto via `setsid nohup`, sobrevive ao fim da
sessão SSH mas não a um reboot da VPS. `dialplan voicecore-test` em `/etc/asterisk/extensions.conf`
(não versionado) segue configurado pra rotear a extensão de teste pro app Stasis. Regra de firewall
UDP 10000-20000 é permanente (fica mesmo depois do reboot/fim da sessão). CRM de produção
(container `app`) confirmado saudável durante todo o processo — nenhuma das mudanças de hoje
derrubou o site.

**Credenciais usadas nesta sessão de voz gravadas no Infisical** (env `prod`, projeto já existente
— `INTERNAL_SECRET`/`SUPABASE_DB_URL` já estavam lá; adicionados `VOICE_ARI_USERNAME`,
`VOICE_ARI_PASSWORD`, `VPS_HOST`, `VOICE_MEDIA_EXTERNAL_HOST`), pra não precisar re-extrair via SSH
numa próxima sessão.

**Ainda não fechado formalmente (pendências reais, não bloqueadores) — retomar amanhã:**
- Testar ligação com `VOICE_MEDIA_LISTEN_MS=800` (worker já rodando com esse valor, não testado
  ainda depois do ajuste).
- Decidir se latência ~5.5-6s é aceitável ou se vale investir em streaming/VAD real (mudança de
  arquitetura, não config).
- dialplan/worker/sidecar do Task 8 continuam como processos manuais fora do Git — falta decidir
  se viram serviço systemd versionado ou se são desligados.
- `docs/evidence/voice-agent-os-real-call-2026-08-30.md` (evidência formal da Task 8) ainda não
  escrito.
- Regra de firewall foi adicionada só nesta faixa exata — não auditado se outras portas UDP do
  `rtp.conf` de outras instâncias precisam da mesma regra.

**Veredito desta atualização:** **CÓDIGO UNIFICADO (SIP/BYOC + RTP + Agent OS real) MERGEADO EM
`main` E ENVIADO A `origin` / DEPLOY REAL EM PRODUÇÃO CONCLUÍDO E VERIFICADO (`307`, containers
saudáveis, rotas de voz deixaram de ser `404`) / TRÊS BUGS DE INFRA PRÉ-EXISTENTES DO PIPELINE DE
BUILD DOCKER ACHADOS E CORRIGIDOS NA RAIZ / SEIS BUGS REAIS DA INTEGRAÇÃO SIP/BYOC ACHADOS E
CORRIGIDOS UM A UM NUMA LIGAÇÃO REAL (2 SQL, 1 CONFIG DE SESSÃO, 1 FIREWALL DE NUVEM) / **PRIMEIRA
LIGAÇÃO REAL COM ÁUDIO DE PONTA A PONTA CONFIRMADA PELO DONO AO VIVO EM PRODUÇÃO, 2026-08-30** —
Task 8 do plano tecnicamente provada; falta só o registro formal de evidência.

### Atualização 2026-08-31 — medição final de latência e encerramento operacional da prova

O worker foi inspecionado antes do teste e confirmou `VOICE_MEDIA_LISTEN_MS=800` no processo
vivo, além de sidecar em `127.0.0.1:8500` e health `ok`. Foram instrumentados timestamps
estruturados sem registrar áudio, transcript ou segredos. Em três ligações reais, o tempo do
fim da janela com fala até ao primeiro frame TTS foi `2.872s`, `2.611s` e `1.240s`; o tempo
total desde `StasisStart` foi `9.274s`, `13.348s` e `3.137s`. O STT local variou
`0.988–2.539s`, o `/turn` `54–233ms` e o `/speak` até ao primeiro frame `171–265ms`.

Decisão: aceitar a janela de 800ms e a latência observada como limitação temporária desta
prova; streaming/VAD incremental e STT mais rápido ficam como item futuro de arquitetura. Não
foi implementado streaming. O componente variável dominante observado foi STT local, não Agent
OS nem TTS.

Após a prova, foram desligados o worker SIP/BYOC, o sidecar STT/TTS e o bridge legado
`audio_bridge_v15.mjs`. A unidade systemd existente não foi promovida: é unidade antiga de teste
apontando para `/opt/voice-sip-test`, não runtime de produção versionado. As portas `8091` e
`8500` ficaram sem listener e não restaram canais Asterisk de teste.

Auditoria de firewall/RTP: há uma única instância Asterisk ativa, com `rtpstart=10000` e
`rtpend=20000`; não foi encontrada outra faixa RTP ou outra instância que exigisse regra
adicional. A regra Hetzner UDP `10000-20000` cobre a configuração efetiva. A evidência formal
está em `docs/evidence/voice-agent-os-real-call-2026-08-30.md`.

Task 8 permanece parcialmente provada: áudio e latência estão comprovados, mas as chamadas
continuam `voice_calls.state=active` porque os eventos terminais perdem `SIP_CONNECTION_ID`
quando o canal já foi destruído. O detach de mídia funciona nessa corrida; a transição
`active` → `completed` ainda precisa de correção/validação antes do fechamento global.

### Atualização 2026-08-31 — reteste Pipecat bloqueado no preflight de memória

Foi confirmado no histórico que a única variável nova desde a tentativa Pipecat pausada de
2026-08-29 é a regra permanente do Hetzner Cloud Firewall para UDP `10000–20000`, adicionada em
2026-08-30. A tentativa anterior já tinha usado Asterisk 22.11.0, `chan_websocket`, porta SIP
`5061`, `rtp.conf` com `rtpstart=10000`/`rtpend=20000`, dialplan simplificado, `ice_support=no`,
endpoint com `rtp_symmetric`/`rewrite_contact`/`force_rport`, Pipecat 1.1.0/1.8.1,
`pipecat-asterisk` 0.1.3 e `OpenAIRealtimeLLMService`.

Antes de reinstalar, a VPS foi auditada sem alterar nada: `/opt/asterisk-v2/` e
`/opt/voice-vps-bench-v2/` continuam ausentes; Asterisk de produção segue isolado na porta
`5060`; worker SIP e sidecar de produção continuam ativos. `free -h` mostrou `129 MiB` livres,
`516 MiB` disponíveis e swap em `1,8 GiB/4 GiB`. Pela restrição de memória, a reinstalação e o
reteste foram interrompidos antes de qualquer download, compilação, criação de venv ou processo
novo. Nenhuma ligação, alteração de firewall ou redeploy foi feito.

Estado: **BLOCKED — memória insuficiente para reinstalar com segurança**. Retomar exige primeiro
liberar memória ou obter autorização explícita para uma janela operacional que pare componentes
não produtivos; a produção na porta `5060` não deve ser parada como parte deste reteste.

### Atualização 2026-08-31 — Asterisk-v2 recompilado e teste RTP sintético isolado

Com os containers de memória não essenciais parados pelo dono, o preflight mostrou cerca de
`1,0 GiB` disponíveis. A instância isolada foi reconstruída em `/opt/asterisk-v2/` a partir do
Asterisk oficial `22.11.0`, com `make -j2` protegido por guarda de `MemAvailable`; configure,
compilação e instalação terminaram sem cruzar o limite de `300 MiB` (o menor valor observado foi
cerca de `1,0 GiB` disponíveis). Produção em `/etc/asterisk`, porta `5060`, worker e sidecar não
foram tocados.

O v2 está rodando na porta SIP `5061`, com `chan_websocket.so` e `res_http_websocket.so` carregados,
HTTP/WebSocket em `8089`, e `rtp show settings` confirma `10000–20000`, ICE desativado. O ambiente
isolado `/opt/voice-vps-bench-v2` instalou `pipecat-ai==1.1.0` e `pipecat-asterisk==0.1.3`; os
imports e assinaturas do transporte/serializer passaram.

Foi executado um INVITE SIP sintético local para `700` usando um endpoint de teste e o dialplan
`Record()`. A sinalização completou (`Successful call=1`, canal `PJSIP/test/.../Record`), e o
RTP alocado pelo v2 foi observado na faixa configurada (ex.: `m=audio 14504`/`16414` nas respostas
SDP). O arquivo de gravação criado foi
`/opt/asterisk-v2/var/lib/asterisk/sounds/v2-test.wav`, `44 bytes` (apenas cabeçalho): o gerador
SIPp não enviou áudio ao porto negociado, portanto **RTP recebido pelo Asterisk ainda não está
provado**. Não foi feita ligação real, não foi iniciado pipeline Pipecat/OpenAI e nenhum firewall
foi alterado.

Estado: **BLOCKED — falta prova interna de RTP com payload** antes de testar Pipecat. O próximo
passo seguro é corrigir o gerador RTP sintético (origem/porto negociado) ou usar uma captura de
áudio já existente; só depois de um WAV com bytes de áudio, e não apenas o cabeçalho, deve-se
subir o pipeline completo. O v2 permanece isolado e pode ser encerrado sem impacto na produção.

### Atualização 2026-08-31 — RTP sintético corrigido: áudio real confirmado

O gerador foi corrigido para aguardar e extrair o `m=audio <porto>` da resposta SDP do Asterisk-v2
(em vez de assumir uma porta fixa). O endpoint SIP sintético usa `rtp_symmetric=yes`, e o script
envia pacotes RTP PCMU válidos para o porto negociado, mantendo a produção intocada.

Novo teste: SIPp → `127.0.0.1:5061` → extensão `700` → `Record()`. O SDP anunciou, por exemplo,
`m=audio 11616 RTP/AVP 0`. O WAV produzido em
`/opt/asterisk-v2/var/lib/asterisk/sounds/v2-test.wav` tem `71.724 bytes`, `35.840 frames`,
`4,48 s`, pico PCM `32124`, RMS `32124` e `35.840/35.840` amostras não nulas. Isto confirma
payload de áudio real chegando ao Asterisk-v2 e sendo gravado; o resultado anterior de `44 bytes`
era apenas o cabeçalho porque o gerador apontava para o porto errado/sem payload audível.

Memória após o teste: aproximadamente `539 MiB` livres e `1,3 GiB` disponíveis; o limite de
segurança de `300 MiB` de memória disponível não foi atingido. Não houve ligação real, alteração
de firewall ou início do pipeline Pipecat/OpenAI.

Estado: **PASS para a hipótese de transporte RTP/firewall no v2**. A regra UDP Hetzner
`10000–20000` é compatível com a faixa configurada e o Asterisk recebeu/grava áudio quando o
porto SDP foi usado corretamente. O pipeline Pipecat/OpenAI permanece deliberadamente parado;
aguarda decisão do dono para o próximo passo.

### Atualização 2026-08-31 — primeira subida isolada do pipeline Pipecat/OpenAI

Antes de instalar a única dependência ausente (`uvicorn`), `free -h` mostrou aproximadamente
`1,2 GiB` de `MemAvailable`, acima do requisito de `800 MiB`. A instalação terminou sem cruzar o
limite crítico de `300 MiB`; após o teste, `MemAvailable` permaneceu em aproximadamente `1,2 GiB`.
O `OPENAI_API_KEY` foi obtido do Infisical sem imprimir o valor e removido do arquivo temporário
após o uso.

Foi criada uma aplicação isolada em `/opt/voice-vps-bench-v2/pipecat_v2.py`, usando
`AsteriskWebsocketTransport`, `Pipeline`, `PipelineTask`, `OpenAIRealtimeLLMService` e o venv já
existente (`pipecat-ai==1.1.0`, `pipecat-asterisk==0.1.3`). A primeira tentativa usou o nome
histórico `gpt-4o-realtime-preview` e a API respondeu `invalid_request_error.model_not_found`.
O catálogo atual da chave foi consultado sem expor segredo; o modelo válido selecionado foi
`gpt-realtime`. O servidor Pipecat subiu e aceitou WebSocket sintético, processando
`MEDIA_START` `slin16` e frames binários de áudio; o log confirmou `PIPELINE_WS_ACCEPTED`,
`PIPELINE_CLIENT_CONNECTED`, `Received MEDIA_START` e `START_MEDIA_BUFFERING`.

O teste sintético com áudio gerado localmente não produziu resposta de áudio observável do
OpenAI/Pipecat: não houve log de resposta nem frames binários de saída. A causa ainda não foi
isolada entre o fluxo de disparo do `PipelineTask`/agregador em Pipecat 1.1.0 e o protocolo de
áudio do teste; não é correto declarar ponta a ponta concluído. O processo Pipecat foi parado
para não manter pressão de memória. Asterisk-v2 continua isolado na porta `5061`; produção na
porta `5060` permaneceu intocada. Nenhuma ligação real foi feita.

Estado: **BLOCKED — pipeline Pipecat/OpenAI ainda sem evidência de resposta de áudio**. O próximo
passo deve instrumentar o serviço Realtime e validar o fluxo com o protocolo `chan_websocket`
real (ou um teste Pipecat mínimo que force explicitamente `LLMRunFrame`/commit de áudio) antes de
qualquer ligação real.

### Atualização 2026-08-31 — raiz do falso bloqueio Pipecat isolada e teste interno PASS

Foi instrumentado temporariamente o envio de eventos do `OpenAIRealtimeLLMService` sem expor a
chave. A primeira reprodução enviava apenas um tom contínuo; o serviço encaminhava muitos
`input_audio_buffer.append`, mas não havia silêncio/fim de fala para o `server_vad` disparar um
turn. A hipótese foi testada adicionando áudio de fala gerado localmente (`slin16`, 16 kHz) mais
`1 s` de silêncio real no fim.

Resultado do teste WebSocket sintético contra `/opt/voice-vps-bench-v2/pipecat_v2.py`:

- evento `MEDIA_START` com `format=slin16` aceito;
- frames binários de áudio enviados para o transporte;
- evento de saída `{"command":"START_MEDIA_BUFFERING"}`;
- evento de interrupção `{"command":"FLUSH_MEDIA"}`;
- `audio_frames=18`, `audio_bytes=175360` recebidos pelo cliente de teste como resposta do
  pipeline/OpenAI Realtime.

O teste de saudação inicial, executado separadamente, também recebeu `audio_frames=5` e
`audio_bytes=49920`. A conexão direta à API confirmou `session.created`, `session.updated`,
`response.created` e `response.output_audio.delta`. O modelo válido atual é `gpt-realtime`; o
nome histórico `gpt-4o-realtime-preview` foi rejeitado como inexistente.

Conclusão: o ciclo áudio → Pipecat → OpenAI Realtime → áudio de resposta fecha internamente. O
falso bloqueio era o fixture sintético sem silêncio suficiente para o `server_vad`, não falha de
autenticação, formato ou rede. O processo foi parado após a prova para manter margem de memória;
produção na porta `5060` permaneceu intocada e nenhuma ligação real foi feita nesta investigação.

### Atualização 2026-08-31 — instância Pipecat preparada para chamada real controlada

Preflight antes de iniciar o processo: `MemAvailable` aproximadamente `1,38 GiB` (acima do
requisito de `800 MiB`). O processo isolado `/opt/voice-vps-bench-v2/pipecat_v2.py` foi iniciado
com a chave OpenAI obtida do Infisical sem exposição do valor e está a escutar apenas em
`127.0.0.1:7860`. Asterisk-v2 permanece separado na porta SIP `5061`.

Foi adicionada a extensão isolada `701`, sem alterar a extensão `700` de `Record()`:

```ini
exten => 701,1,NoOp(Isolated Pipecat WebSocket test)
 same => n,Dial(WebSocket/pipecat-v2/c(slin16)f(json),60)
 same => n,Hangup()
```

`websocket_client.conf` aponta `pipecat-v2` para `ws://127.0.0.1:7860/ws`, usando conexão por
chamada e protocolo JSON. A rota foi validada com `dialplan show 701@voicecore-test`; o módulo
`res_websocket_client.so` está carregado. Nenhuma chamada foi feita pelo agente nesta etapa.

O dono pode usar a conta SIP `1000` já existente no Zoiper, servidor `2.29.8.225`, porta UDP
`5061`, e discar `701`. A conta/rota de produção na porta `5060` permanece intocada.

### Atualização 2026-08-31 — Fase 2: testes de robustez internos

Preflight: `MemAvailable` variou entre aproximadamente `875 MiB` e `1,2 GiB` durante os testes;
nenhum cenário cruzou o limite crítico de `300 MiB`. A produção na porta `5060` não foi usada nem
alterada.

Resultados do harness sintético contra `127.0.0.1:7860/ws`:

- **Silêncio prolongado (5 s): PASS** — conexão terminou normalmente; `8` frames de áudio de
  saudação, `61440` bytes, sem erro.
- **Fala longa (áudio + silêncio final): PASS parcial** — `7` frames, `74240` bytes, e
  `FLUSH_MEDIA`; processamento terminou normalmente.
- **Queda a meio da chamada: PASS de recuperação do processo** — cliente fechou durante o áudio;
  o Pipecat cancelou a tarefa e o processo continuou vivo. O log registra avisos de frames que
  chegaram depois do fechamento (`Cannot write audio frame because the WebSocket client is
  closing or already closed`), que precisam de tratamento mais limpo antes de produção.
- **Reconexão WebSocket: PASS básico** — duas conexões sequenciais foram aceites e encerradas sem
  crash (`pipeline_ws_accepted`/`pipeline_client_connected` em ambas).
- **Queda da OpenAI: FAIL de requisito de fallback** — servidor separado com modelo inválido
  recebeu e expôs `invalid_model` (“Model ... is not supported in realtime mode”), mas o fluxo
  não enviou áudio de fallback equivalente ao “Desculpe, não posso ajudar agora” do worker atual.

O erro de modelo histórico também foi confirmado como detectável; o modelo válido permanece
`gpt-realtime`. Os testes comprovam tolerância básica a silêncio, duração, queda e reconexão, mas
não fecham a Fase 2: falta implementar/documentar fallback de voz e reduzir os avisos de corrida
no fechamento do WebSocket. Nenhuma ligação real adicional ou cutover foi feito.

### Atualização 2026-08-31 — Fase 2: saudação, fallback e regressão após fix de corrida

O estado atual de `ops/voice-asterisk/pipecat-v2/pipecat_v2.py` foi puxado antes da alteração;
o fix do Vetor (`transport._output._params.audio_out_enabled = False` antes de cancelar a tarefa)
foi preservado. A aplicação agora inclui instrução no contexto inicial para o modelo cumprimentar
o utilizador primeiro, disparada por `LLMRunFrame` em `on_client_connected`, sem `TTSSpeakFrame` de
saudação e sem alteração do transporte.

Fallback adicionado para erros/queda do Realtime: `openai_realtime_error` enfileira uma única
`TTSSpeakFrame("Desculpe, não posso ajudar com isso agora.")`; um monitor do receive task também
enfileira a mesma frase se a conexão Realtime terminar inesperadamente durante uma ligação ativa.
O log confirma `openai_fallback_queued reason=realtime_error` quando um modelo inválido é forçado.
O frame é o contrato de saída para o TTS; o protótipo atual não inclui um motor TTS separado, logo
o áudio audível do fallback ainda precisa ser ligado a um serviço TTS/local antes do cutover.

Regressão sintética após a alteração:

- silêncio prolongado: `8` frames / `104960` bytes de áudio de saudação, encerramento normal;
- fala longa: `14` frames / `111360` bytes, `FLUSH_MEDIA`, encerramento normal;
- queda no meio: cancelamento sem crash, com `audio_out_enabled` desativado antes do cancelamento;
- reconexão: duas conexões sequenciais aceites e encerradas sem crash;
- erro OpenAI: `invalid_model` detectado e fallback enfileirado exatamente uma vez.

Memória permaneceu acima de `300 MiB` disponíveis em todos os cenários; o menor valor observado
foi aproximadamente `875 MiB`. O processo Pipecat foi parado após os testes e a chave temporária
removida. Nenhuma ligação real adicional, alteração de firewall ou mudança na produção foi feita.

Fase 2 continua **parcialmente bloqueada** até haver um consumidor TTS real para o
`TTSSpeakFrame` de fallback e teste que comprove bytes de áudio desse fallback, não apenas o
enfileiramento do frame.

### Atualização 2026-08-31 — fallback ligado ao Piper local e comprovado em áudio

Foi reutilizado o sidecar Piper já existente em produção (`127.0.0.1:8500`, endpoint `/speak`),
sem baixar modelo novo nem instalar motor pesado. A aplicação Pipecat agora inclui
`SidecarPiperTTSService`, que envia o texto do `TTSSpeakFrame` ao sidecar, decodifica µ-law 8 kHz
para PCM e entrega frames PCM 16 kHz ao `AsteriskWebsocketTransport`. O sidecar foi exercitado
diretamente antes do teste e retornou `21270` bytes µ-law.

Com o erro Realtime forçado (`invalid-realtime-model`), o log confirmou `openai_fallback_queued`
e o cliente WebSocket recebeu `audio_frames=2`, `audio_bytes=80640`. O áudio do sidecar,
convertido para PCM, mediu `peak=32124`, `RMS=7334.04` e `20890` amostras não nulas: áudio real,
não silêncio nem apenas enfileiramento de frame.

Memória antes do teste: aproximadamente `1,3 GiB` disponíveis; depois, aproximadamente `1,1 GiB`.
O processo de teste foi encerrado e a chave temporária removida. Produção na porta `5060` não foi
tocada.

O fallback agora tem caminho de áudio audível; ainda requer regressão completa de chamadas normais
antes do cutover.
