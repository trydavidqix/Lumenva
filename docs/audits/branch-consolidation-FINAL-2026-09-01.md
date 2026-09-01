# Consolidação final de branches — DeskcommCRM

**Data:** 2026-09-01  
**Checkout auditado:** `/Users/david/Desktop/CRM/DeskcommCRM`  
**Base auditado:** `main` em `60ed322f19c6bff962029bbe360f16f82913f7ae` (também `origin/main`)
**Fontes consolidadas:**

- `docs/audits/branch-consolidation-plan-2026-09-01.md`
- `docs/audits/voice-phase1-deep-audit-2026-09-01.md`
- `docs/audits/phase3-content-os-audit-2026-09-01.md`
- `docs/audits/phase4-gateway-dependabot-audit-2026-09-01.md`
- achado reportado por Terra sobre Agent OS/Fase 7

**Nota histórica:** as decisões abaixo foram escritas antes da execução e preservadas como contexto. O status executado e vinculante deste fechamento está na seção seguinte.

## Status final executado em 2026-09-01

O `git log` de hoje confirma que a consolidação foi executada em `main`: Content OS + C-1/C-2/C-3, gateway seletivo, Agenda/Nuvemshop e a correção de idempotência do Vercel Workflow foram incorporados. O Agent OS está parcialmente integrado: Fases 2 (Kernel), 4 (SHADOW/evals) e 5 (autonomia assistida) estão alcançáveis em `main`; Fases 3 (agentes de produto), 6 (flywheel) e 7 (benchmark durável) continuam fora de `main` para continuação controlada.

O commit `cacf6185` corrigiu uma falha de segurança real: `content_os_enforce_tenant_fk()` é `SECURITY DEFINER` e podia ser invocada pelos papéis públicos. A migration `0134` e o apêndice de `baseline.sql` revogam `EXECUTE` de `public`, `anon` e `authenticated`, concedendo-o apenas a `service_role`.

O fix de Fase 7 (`5bb29957`/`f638ce8f`) está em `main`, mas a Fase 7 não está concluída: o rerun Vercel completo ainda é obrigatório. A Fase 6 mantém risco de colisão com flywheel/constraints existentes; a Fase 3 e os handlers da Fase 7 exigem revisão de rotas e contratos. A limpeza de branches/worktrees foi parcial: a fotografia final ainda mostra worktrees ativos, portanto não há autorização documental para declarar todos os órfãos removidos.

Para o handoff operacional de amanhã, consulte [`HANDOFF-2026-09-01-consolidacao-agent-os.md`](../handoffs/HANDOFF-2026-09-01-consolidacao-agent-os.md).

## Decisão final

### 1. Voz e SIP/RTP

| Família/ref | Decisão final | Motivo e condição |
|---|---|---|
| `codex/voice-media-bridge` | **Não integrar; arquivar depois** | Os dois commits têm patch-id equivalente a `6c005ad4` e `e6163804` já alcançáveis em `main`. |
| `codex/voice-pipecat-runtime` | **Não integrar; manter em observação até prova externa** | Patch equivalente a `30a01051` já está em `main`; Pipecat real continua `BLOCKED EXTERNAL`. |
| `codex/voice-stt-tts` | **Não integrar; arquivar depois** | Patch equivalente a `7189ec9c` já está em `main`. |
| `codex/voice-crm-config` | **Não integrar; arquivar depois da confirmação do worktree** | Conteúdo reaplicado semanticamente por `d8eb943b`; o patch-id difere apenas por contexto posterior. |
| `codex/voice-security-tests` | **Não integrar; arquivar depois** | Patch equivalente a `44a8e74e` já está em `main`. |
| `codex/voice-qa-ops` | **Não integrar; arquivar depois** | Gate/runbook já absorvido em `c6fffbc1`; executar o gate no checkout final, sem reaplicar a branch. |
| `codex/voice-media-integration` | **Manter em observação; arquivar somente após fechar worktree** | Integração histórica já alcançável; worktree ativo. |
| `codex/voice-unify-media-2026-08-29` | **Manter em observação; não cherry-pickar** | Correção de loop RTP já equivalente/alcançável; worktree ativo. |
| `codex/voice-architecture-audit` | **Manter em observação até encerramento da auditoria** | Documentação/handoff, sem código novo provado; worktree ativo. |
| `codex/voice-migration-fix` | **Manter em observação; recuperar contexto antes de arquivar** | Histórico já absorvido, mas worktree `/private/tmp/voice-core-fix` está `prunable`. |
| `origin/implementacao-tokens`, `origin/implementacao-tokens-copy`, `origin/implementacao-tokens-voice-core`, `origin/implementacao-tokens-voice-core-e2e-final` | **Não integrar; arquivar depois** | Todas ancestrais ou com patches equivalentes em `main`; não há trabalho novo provado. |

Conclusão da Fase 1: **zero cherry-picks de voz**. A validação posterior deve rodar typecheck, lint, unitários e `bash scripts/verify-voice-qa.sh provider-free`; equivalência de patch não é prova de funcionamento real de carrier/Pipecat.

### 2. Agent OS

| Ref/família | Decisão final | Motivo e condição |
|---|---|---|
| `agent-os-phase-7-durable-benchmark` local (`1c75f7e1`) | **Não integrar o commit adicional; manter em observação** | Terra confirmou que difere do remoto somente por um commit Docker/Postgres cujo efeito já está em `main` via `7fe2929c`, `e91f2401`, `3865ae34` e `f3acf706`. |
| `origin/agent-os-phase-7-durable-benchmark` (`f40725a3`) | **Manter em observação; rerun obrigatório** | Fase 7 está **INCOMPLETE**: Vercel Workflow falhou em 208/208 testes; Inngest passou em 208/208. Reexecutar Vercel pós-fix antes de qualquer promoção. |
| `origin/agent-os-phase-6-learning-flywheel`, `origin/agent-os-verification` | **Manter em observação** | Linhas acumulativas de verificação; não promover enquanto Fase 7 não tiver resultado Vercel reproduzível. |
| Fases 2–5 e plans (`origin/agent-os-implementation-plan`, `phase-2-kernel`, `phase-3-product-agents`, `phase-4-shadow-evals`, `phase-4-shadow-evals-planning`, `phase-5-assisted-autonomy`) | **Arquivar como histórico somente após escolher uma ponta canônica** | Há relações subset/superset por patch-id; cherry-pick indiscriminado duplicaria trabalho. |

Decisão operacional: não integrar a Fase 7 agora. O próximo passo é um rerun do Workflow Vercel no commit/fix correto, registrar os 208 casos e só então decidir se existe patch novo real.

### 3. Content OS

| Ref/família | Decisão final | Motivo e condição |
|---|---|---|
| `gpt-lumenva-content-os` local e `origin/gpt-lumenva-content-os` (`cda205c9`) | **Integrar em lote único, após correções bloqueadoras** | Local e remoto são a mesma ponta: 24 commits, 42 arquivos, migration, baseline, tipos, providers e testes. Escolher uma única ref; não integrar ambas. |
| `lib/content-os/**`, Spec 17, migration e contratos | **Integrar somente depois dos itens de trabalho C-1, C-2 e C-3** | A série é coerente, mas não está pronta funcionalmente. Resolver `event_log`, anti-SSRF e coerência cross-tenant antes do lote. |
| Postiz/distribuição | **Manter em observação / fora da integração funcional** | Existem contratos/stubs, não provider executável; não alegar publicação implementada. |

Forma recomendada: branch de consolidação a partir de `main`, aplicar a série Content OS como lote, resolver colisões em `lib/database.types.ts` e `supabase/migrations/MANIFEST.md`, e executar gates de schema/RLS e unitários no SHA final.

### 4. Gateway de canais

| Ref | Decisão final | Motivo e condição |
|---|---|---|
| `origin/implementacao-tokens-channel-gateway` (`76dda2b1`) | **Cherry-pick seletivo** | A branch inteira tem história divergente e 256 arquivos no diff de dois pontos, incluindo remoções indevidas. Não fazer merge da ponta. |
| `9f84f3fe` | **Não cherry-pickar automaticamente** | Bootstrap/contratos-base já são funcionalmente representados em `main`; usar apenas como comparação. |
| `2b59dd3e` | **Cherry-pick seletivo primeiro** | Supervisor de saúde, leases e recuperação de sessão; revisar contra runtime atual. |
| `bb468c0b` + `08da2687` | **Cherry-pick seletivo em conjunto** | Resolução exata e fail-closed de identidade; dependem de contratos e testes coerentes. |
| `76dda2b1` | **Cherry-pick seletivo por último** | Trace, sanitização de logs, tenant scope e autorização; exige revisão de segurança e `lint:channels`. |

O gateway fica `NOT_PROVEN` até typecheck, testes selecionados, `lint:channels`, `lint:tenant-filter`, build e revisão de que nenhum runtime de voz/documentação foi removido.

### 5. Dependabot

| Ref | Decisão final | Motivo e caminho futuro |
|---|---|---|
| `origin/dependabot/npm_and_yarn/gpt-tokenizer-4.0.0` (`775b1f3e`) | **Fechar branch/PR** | Atualização antiga, sem gates; risco de mudança silenciosa de `cl100k_base` para `o200k_base` no entrypoint raiz e remoção de bundle UMD. Se ainda necessária, recriar a partir de `main` com teste explícito de `TokenCounter`. |
| `origin/dependabot/npm_and_yarn/minor-and-patch-cc63521167` (`8113eedc`) | **Fechar branch/PR** | Pacote agrupado com 33 atualizações e grande lockfile; não permite atribuir regressões. Reabrir em lotes pequenos a partir de `main`, com licença e gates por lote. |

### 6. `upstream/*`

| Família | Decisão final |
|---|---|
| `upstream/cal/*`, `upstream/tmp-*`, `upstream/feat/*` de Agenda | **Manter em observação; cherry-pick seletivo somente após comparar com `upstream/main` e `main`** |
| `upstream/fix/*`, `upstream/test/*`, `upstream/qa/*` | **Revisar patch a patch; integrar somente correções ainda ausentes e reproduzíveis** |
| `upstream/pr*`, `triagem/*`, `rebase-*`, `resolve-*`, `resgate/*` | **Arquivar depois de extrair patches úteis e confirmar que não há revisão/dependência ativa** |
| `upstream/release/*`, `docs/*`, `chore/deps-major-bumps`, `ecc-tools/*` | **Manter em observação até confirmar valor histórico/documental; não fazer merge amplo** |
| `upstream/main` | **Não integrar** | História divergente; serve apenas como base histórica para comparação. |

Não há autorização implícita para remover qualquer ref `upstream`. A decisão depende de patch-id, dependências e confirmação do servidor/responsáveis.

### 7. Branches já incorporadas e duplicatas

`origin/codex/crm-consolidated`, `origin/docs/complete-doc-sync`, `origin/docs/dead-cache-doc-refs`, `origin/fix/inbox-item-severity-vocab`, `origin/fix/squad-e2e-handoff-continuity` e `origin/sync/upstream-cherrypicks` são ancestrais ou equivalentes já alcançáveis. **Arquivar depois**, preservando nomes remotos até confirmar uso, proteção e ausência de worktree.

`main` e `origin/main` ficam preservadas. O remoto `origin/main` (`56260cea`) está atrás da ponta local; não usar como base atual sem sincronização autorizada.

## Bloqueadores reais — itens de trabalho separados

Estes itens não são decisões de merge. São tarefas técnicas que precisam de resolução e evidência própria.

### C-1 — Vocabulário e formato de `event_log`

- O contrato canônico aceita dois segmentos (`domínio.evento`), mas Content OS grava eventos de três segmentos, como `content.signal.collected`.
- `lib/content-os/events.ts`, Spec 17 e `tests/unit/content-os-events.test.ts` também divergem sobre 13 versus 15 eventos.
- O repository descarta `requestId` e grava payload camelCase sem decisão explícita sobre o formato persistido.
- Trabalho: decidir vocabulário canônico, alinhar implementação/spec/teste, preservar idempotência e payload auditável, adicionar teste de inserção real contra constraint.
- **Bloqueio:** não integrar Content OS até o contrato e o teste passarem.

### C-2 — Anti-SSRF no monitor de concorrentes

- `CompetitorService.createMonitor` aceita `targetUrl` sem validação completa de esquema, host, rede privada ou metadata endpoint.
- A validação no adapter remoto não substitui a guarda na entrada do domínio.
- Trabalho: criar validação allowlist/denylist server-side, cobrir IPv4/IPv6, DNS rebinding, redirects e metadata endpoints, e adicionar testes negativos.
- **Bloqueio:** não expor criação de monitor nem integrar a superfície Content OS sem a guarda.

### C-3 — Integridade cross-tenant das FKs Content OS

- RLS cobre as tabelas, mas as FKs não forçam, no nível relacional, que o `organization_id` do pai e do filho coincida.
- Trabalho: decidir entre FKs compostas/trigger ou writers confiáveis; implementar a decisão e um teste de tentativa cross-tenant.
- **Bloqueio:** migration/baseline/tipos não devem ser promovidos sem essa decisão documentada.

### C-4 — Risco do `gpt-tokenizer` 4.0

- A atualização muda o entrypoint raiz e pode alterar a base de tokenização usada por `lib/ui/TokenCounter.tsx`.
- Trabalho: confirmar API e base (`cl100k_base` explícita se esse for o contrato), verificar bundle cliente, lockfile, licença e executar instalação congelada, typecheck, lint, unitários e build.
- **Bloqueio:** não integrar `775b1f3e`; a decisão atual é fechar e reabrir em branch nova se necessário.

### C-5 — Vercel Workflow na Fase 7 do Agent OS

- Vercel Workflow: **208/208 falhos**.
- Inngest: **208/208 passou**.
- Trabalho: identificar a causa do fracasso Vercel, aplicar/confirmar o fix, executar rerun completo e registrar SHA, logs e resultado; não usar o resultado Inngest como substituto.
- **Bloqueio:** Fase 7 permanece **INCOMPLETE** e não deve ser integrada/promovida.

## Estimativa realista para execução

Estimativa de tarefas paralelas independentes, não de novas auditorias. Um mesmo agente pode assumir duas tarefas pequenas se o orquestrador preferir reduzir coordenação.

| Bloco de implementação | Tarefas separadas | Agentes recomendados | Entrega |
|---|---:|---:|---|
| Voz: confirmação final e gates provider-free | 1 | 1 | prova de patch já integrado, gates e lista de worktrees a arquivar |
| C-1 `event_log` | 1 | 1 | contrato, código, spec, testes e migration compatíveis |
| C-2 anti-SSRF | 1 | 1 | guard server-side e testes de rede/redirect |
| C-3 FKs/RLS Content OS | 1 | 1 | decisão de integridade, migration/tipos e teste cross-tenant |
| Integração Content OS | 1 | 1 | lote `cda205c9` resolvido e gates completos |
| Gateway seletivo | 1 | 1 | quatro commits portados/revisados, sem regressões de `main` |
| Agent OS Fase 7 | 1 | 1 | rerun Vercel 208/208 pós-fix e decisão de promoção |
| Dependabot tokenizer | 1 | 1 | recriação opcional, compatibilidade de tokens e build |
| Dependabot grupo 33 atualizações | 1 | 1 | divisão em lotes, licenças e gates por lote |
| Upstream Agenda/produto | 1 | 1 | seleção de patches úteis, sem merge de história divergente |
| Upstream triagem/release/docs | 1 | 1 | extração de patches e lista de refs arquiváveis |
| Integração final e verificação | 1 | 1 | branch final, typecheck/lint/unit/db/build e relatório SHA-bound |

**Mínimo realista:** 12 tarefas e 8 agentes, agrupando as três tarefas Content OS em dois agentes e os dois blocos Dependabot em um agente.  
**Execução com isolamento máximo:** 12 tarefas e 12 agentes. Não há benefício em recrutar dezenas de agentes: os conflitos em `database.types.ts`, `MANIFEST.md`, `main` e os gates finais exigem coordenação de um único integrador.

## Ordem de execução aprovada para a próxima rodada

1. Congelar nova fotografia de refs e preservar a árvore suja.
2. Executar C-1, C-2 e C-3 em paralelo.
3. Executar rerun do Agent OS (C-5) independentemente dos blocos de código.
4. Fechar/recriar Dependabot somente se houver decisão de produto para manter as atualizações.
5. Portar o gateway por cherry-pick seletivo.
6. Integrar Content OS em lote único somente quando C-1/C-2/C-3 estiverem verdes.
7. Rodar gates de voz e verificação final no SHA consolidado.
8. Só então arquivar branches duplicadas, ancestrais e temporárias, em lotes pequenos e com confirmação de worktrees.

## Estado e limites

- Confirmado: decisões acima derivadas dos quatro relatórios e do achado Terra.
- Bloqueado: Content OS pelos C-1/C-2/C-3; Agent OS Fase 7 pelo C-5; tokenizer pela ausência de compatibilidade comprovada.
- Não provado: funcionamento real de carrier/Pipecat/WAHA/Meta Cloud, CI verde do gateway e execução dos gates no SHA final.
- Não executado: qualquer mutação Git, instalação, fetch, merge, rebase, push ou remoção.

**Estado do documento:** consolidação final pronta para decisão do dono e dimensionamento da próxima rodada de implementação.
