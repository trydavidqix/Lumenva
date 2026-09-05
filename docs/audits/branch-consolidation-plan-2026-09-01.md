# Plano de consolidação de branches — DeskcommCRM

**Data da fotografia:** 2026-09-01  
**Checkout:** `/Users/david/Desktop/Projetos/CRM/DeskcommCRM`  
**Ponta de integração observada:** `main` = `5336a6a8f7ebda373938fdb7148206b624a2de61` (`voice: bias realtime transcription to Portuguese`)  
**Escopo:** refs locais, `origin/*` e `upstream/*` existentes localmente.  
**Regra:** somente leitura nesta auditoria; nenhum merge, rebase, push, fetch, remoção ou checkout foi executado.

## Decisão executiva

Há 108 refs auditadas: 14 locais, 24 `origin/*` e 70 `upstream/*`. A linha de desenvolvimento deve continuar em `main`. O trabalho que merece decisão de integração concentra-se em Agent OS, Content OS, gateway de canais, Dependabot e nas fatias de voz; `upstream/*` é um espelho histórico divergente e não deve ser misturado por nome de branch.

Nenhuma branch deve ser apagada agora. Primeiro executar a sequência de consolidação abaixo, com aprovação explícita por lote e nova fotografia dos refs. A árvore de trabalho atual está suja e contém alterações de voz/documentação não commitadas; essas alterações ficam fora deste plano.

## Evidência e método reproduzível

Comandos usados, todos no checkout correto:

```bash
git rev-parse --show-toplevel
git status --short --branch
git for-each-ref --format='%(refname:short) %(objectname) %(subject)' refs/heads refs/remotes
git merge-base --is-ancestor REF main
git rev-list --count main..REF
git diff --shortstat main...REF
git log --format='%h %s' main..REF
git cherry main REF
git patch-id --stable
git worktree list --porcelain
```

`git merge-base --is-ancestor` prova somente incorporação no histórico local; não prova ausência de uso operacional, revisão, proteção remota ou dependência de worktree. `upstream/main` = `2674611d` pertence a uma história divergente; contagens relativas à `main` não são suficientes para julgar aquelas refs.

## Inventário completo por ref

Os SHA abaixo são os tips observados nesta fotografia. O assunto do tip foi usado como sinal de conteúdo; a decisão final deve usar o patch completo antes de integrar.

### Branches locais — 14

| Ref | Tip | Conteúdo/decisão |
|---|---|---|
| `main` | `5336a6a8` | linha canônica; preservar |
| `agent-os-phase-7-durable-benchmark` | `1c75f7e1` | Agent OS Fase 7; worktree ativo; preservar e comparar com remoto |
| `codex/voice-architecture-audit` | `d3c97cbd` | documentação/handoff de voz; worktree ativo; preservar até fechar auditoria |
| `codex/voice-crm-config` | `84626e0c` | configurações de tom/tenant de voz; worktree ativo; candidato a cherry-pick após revisão |
| `codex/voice-media-bridge` | `7189ec9c` | consumo correto de RTP; worktree ativo; candidato a cherry-pick |
| `codex/voice-media-integration` | `c6fffbc1` | integração/QA de voz; worktree ativo; já absorvida historicamente em `main`; confirmar antes de arquivar |
| `codex/voice-migration-fix` | `8de44e30` | hidratação SIP/ARI; worktree prunable em `/private/tmp`; recuperar patch antes de qualquer remoção |
| `codex/voice-pipecat-runtime` | `2f497ab9` | fronteira fail-closed Pipecat; worktree ativo; revisar |
| `codex/voice-qa-ops` | `49952a29` | gate QA e runbook provider-free; worktree ativo; revisar duplicação com integração |
| `codex/voice-security-tests` | `55d52063` | privacidade SIP/idempotência; worktree ativo; revisar |
| `codex/voice-stt-tts` | `fe1ca724` | limites STT/TTS; worktree ativo; revisar |
| `codex/voice-unify-media-2026-08-29` | `ec47df9f` | correção de loop de mídia; worktree ativo; conteúdo equivalente à integração; preservar até prova |
| `gpt-lumenva-content-os` | `cda205c9` | Content OS/Intelligence sources; worktree ativo; preservar para decisão de integração |
| `worktree-agent-a39b36ce7ff4128ec` | `54e86839` | documentação de correções RAG; worktree ativo; não remover sem encerrar worktree |

### Refs `origin/*` — 24

`origin/main` (`56260cea`) é remoto canônico observado, mas está atrás do `main` local atual. As refs abaixo são o inventário integral; `A` significa trabalho não alcançável por `main` no momento da fotografia.

- Agent OS: `origin/agent-os-implementation-plan` (`12a2bc32`), `origin/agent-os-phase-2-kernel` (`8ff7c402`), `origin/agent-os-phase-3-product-agents` (`fee44013`), `origin/agent-os-phase-4-shadow-evals` (`63181a16`), `origin/agent-os-phase-4-shadow-evals-planning` (`7bb5c532`), `origin/agent-os-phase-5-assisted-autonomy` (`7ca817c2`), `origin/agent-os-phase-6-learning-flywheel` (`c89260f2`), `origin/agent-os-phase-7-durable-benchmark` (`f40725a3`), `origin/agent-os-verification` (`78543784`). Linha acumulativa; não integrar nove pontas indiscriminadamente.
- Conteúdo: `origin/gpt-lumenva-content-os` (`cda205c9`), 24 commits/42 arquivos; mesma ponta local; preservar uma linha canônica.
- Voz/canais: `origin/implementacao-tokens` (`7018bc4e`, TTS port), `origin/implementacao-tokens-channel-gateway` (`76dda2b1`, gateway/trace/guardrails), `origin/implementacao-tokens-copy` (`1daa09c7`, plano documental), `origin/implementacao-tokens-voice-core` (`d3c97cbd`), `origin/implementacao-tokens-voice-core-e2e-final` (`eb9e35dc`, seam tipado).
- Já ancestrais/duplicatas de trabalho integrado: `origin/codex/crm-consolidated` (`ec47df9f`), `origin/docs/complete-doc-sync` (`9ec117b0`), `origin/docs/dead-cache-doc-refs` (`2a113082`), `origin/fix/inbox-item-severity-vocab` (`8e634961`), `origin/fix/squad-e2e-handoff-continuity` (`510d91c9`), `origin/sync/upstream-cherrypicks` (`160bd616`). Confirmar uso remoto antes de arquivar.
- Dependabot não integrado provado: `origin/dependabot/npm_and_yarn/gpt-tokenizer-4.0.0` (`775b1f3e`) e `origin/dependabot/npm_and_yarn/minor-and-patch-cc63521167` (`8113eedc`). Revisar testes/licenciamento e escolher merge, fechamento ou arquivamento.
- Ref de integração remota: `origin/main` (`56260cea`); preservar como ponte de comparação até a próxima sincronização autorizada.

### Refs `upstream/*` — 70

Inventário integral por família (tip disponível em `git for-each-ref`; nenhum foi considerado integrado automaticamente):

- Agenda/calendário: `cal/w0-schema`, `cal/w1-api`, `cal/w1-google`, `cal/w1-ui`, `cal/w2-agendas`, `cal/w2-mcp`, `feat/agenda-grade-interativa`, `feat/atualizar-pela-ui`, `feat/calendario-vivo`, `fix/agenda-producao`, `tmp-api`, `tmp-g2`, `tmp-sch`, `tmp-ui`, `tmp-ui2`, `tmp-verify`.
- Produto/agentes: `feat/crm-vivo`, `feat/i18n-espanhol`, `feat/ia-360-w2-reter`, `feat/ia-360-w3-escalar`, `feat/inbox-multimodal`, `feat/marca-o-que-faltou`, `feat/operacao-visivel`, `feat/radar-assumir`, `feat/whatsapp-connections`.
- Correções e segurança: `fix/192-ddl-separado-do-runtime`, `fix/218-fiacao-da-central`, `fix/237-zod-nos-webhooks-de-canal`, `fix/265-tipo-de-fonte-de-conhecimento`, `fix/274-marca-logo-instavel`, `fix/agente-mudo`, `fix/ai-invocations-sem-agente`, `fix/ci-timeline-query-env`, `fix/e2e-429-gotrue`, `fix/grade-contaminacao-entre-specs`, `fix/oauth-callback-alcancavel`, `fix/reset-password-mfa`, `fix/service-role-key-formato-novo`, `fv/gatilhos`.
- Testes/QA/CI: `ci/e2e-serial`, `debug/mfa-reset`, `qa/w2-fontes-defasadas-cego`, `test/179-onboarding-fresco-no-ci`, `test/239-rede-visual-antes-do-tailwind4`, `test/sent-via-cabe-na-constraint`.
- Documentação/release: `docs/changelog-agenda`, `docs/living-system-audit`, `docs/living-system-doctrine`, `release/consolida-1.5.0`, `release/v1.1.0`.
- PR/triagem/resgate: `pr-346`, `pr121`, `pr126`, `pr127`, `rebase-52`, `resolve-51`, `resgate/237-zod-nos-webhooks-de-canal`, `triagem/275`, `triagem/322`, `triagem/326`, `triagem/327`, `triagem/327b`, `triagem/c202-demandas`, `triagem/pr198-testes-de-borda`, `triagem/pr201-reprodutor`, `triagem/wconf-194-200`, `triagem/wconf-194-201`.
- Infraestrutura histórica: `chore/deps-major-bumps`, `ecc-tools/DeskcommCRM-1783368833211`, `main`.

## Agrupamento de trabalho e destino recomendado

1. **Linha principal e voz (primeiro):** congelar `main` e comparar as seis fatias locais, `codex/voice-unify-media-2026-08-29`, `codex/voice-media-integration` e `origin/implementacao-tokens*` por patch-id e arquivos. Integrar apenas patches que não estejam já em `main`; preservar contratos SIP, `crm_*`, idempotência, RLS e evidência de testes. A árvore suja de voz não é evidência de commit.
2. **Agent OS (segundo):** usar a fase 7 local como candidata canônica somente após comparar seu commit adicional com `origin/agent-os-phase-7-durable-benchmark`; tratar fases 2–6, planning, verification como histórico acumulativo. `agent-os-implementation-plan` e `phase-4-shadow-evals-planning` são subsets conhecidos; não cherry-pickar o mesmo patch duas vezes.
3. **Content OS (terceiro):** escolher entre `gpt-lumenva-content-os` local e remoto (mesmo SHA); integrar os 24 commits em lote único, com revisão de conflitos em specs/providers/event log. Não misturar com Agent OS sem mapa de dependências.
4. **Gateway/dependências (quarto):** revisar `origin/implementacao-tokens-channel-gateway` e os dois Dependabot em branches temporárias, rodar gates pertinentes e decidir merge/cherry-pick/fecho individual.
5. **Upstream produto/Agenda (quinto):** estabelecer `upstream/main` como base histórica, calcular patch-id contra `main` e selecionar somente commits de `upstream/cal/*`, `feat/*`, `fix/*`, `test/*` que ainda tenham valor. Portar por cherry-pick seletivo; não fazer merge amplo da história divergente.
6. **Triagem/release/docs (último):** extrair patches úteis de `upstream/pr*`, `triagem/*`, `release/*`, `tmp-*`, `rebase-*` e `resolve-*`; depois marcar refs redundantes para arquivamento. Branches de `upstream` com 0 patches únicos contra outra ref ainda exigem confirmação de que o servidor pode descartá-las.

## Riscos de conflito

- **História divergente:** `upstream/main` não é ancestral da ponta local; merge direto pode reintroduzir código e documentação antigos.
- **Sobreposição de voz:** integração, unify-media e seis fatias alteram as mesmas seams SIP/RTP/STT/TTS; resolver por patch-id e comportamento, não por nome.
- **Agent OS acumulativo:** fases posteriores contêm subsets das anteriores; cherry-pick indiscriminado duplica migrations, tipos e docs.
- **Worktrees:** branches locais estão ligadas a worktrees ativos; `codex/voice-migration-fix` aponta para worktree prunable. Não apagar/forçar limpeza antes de recuperação e confirmação do responsável.
- **Estado sujo:** alterações não commitadas em runtime de voz, docs e exemplos podem conflitar com qualquer integração futura; não descartá-las.
- **Contratos críticos:** schema/RLS, `getUser()`, eventos idempotentes, WAHA/SIP, `supabase/config.toml` e aliases `crm_*` exigem gates específicos; documentação ou SHA não provam funcionamento.
- **Remoto atrasado:** `origin/main` está em `56260cea`, atrás da ponta local; não tratá-lo como base atual sem autorização e sincronização posterior.

## O que fica de fora

- Nenhuma remoção de branch/ref, worktree ou objeto Git.
- Nenhum merge, rebase, cherry-pick, push, force-push ou fetch.
- Nenhum descarte de `.infisical.json`, arquivos não rastreados ou alterações de voz.
- Nenhuma promoção de `upstream/*` baseada apenas em nome, contagem ou ausência de commits.
- Nenhuma alegação de produção, CI verde ou integração funcional sem executar os gates correspondentes após a aprovação.

## Checklist de aprovação e execução futura

1. Repetir inventário e confirmar SHAs remotos (fetch somente com autorização).
2. Registrar dependências/worktrees e obter aprovação do responsável de cada linha.
3. Integrar um grupo por vez em branch de consolidação, usando cherry-pick seletivo quando houver história divergente.
4. Executar `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:db` e gates de voz/Agent OS/Content OS aplicáveis; registrar SHA e resultado.
5. Só depois decidir arquivamento/remoção, em lotes pequenos, revalidando `git worktree list`, `git branch -vv` e SHAs preservados.

**Estado do entregável:** plano pronto para aprovação do orquestrador. Nenhuma operação Git de consolidação foi executada.
