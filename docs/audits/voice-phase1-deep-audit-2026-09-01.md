# Auditoria aprofundada — Fase 1 (Voz)

**Fotografia:** 2026-09-01  
**Checkout:** `/Users/david/Desktop/Projetos/CRM/DeskcommCRM`  
**Base canônica:** `main` em `5336a6a8f7ebda373938fdb7148206b624a2de61`  
**Escopo:** somente leitura; nenhum `fetch`, `merge`, `rebase`, `cherry-pick`, `push`, checkout, remoção de ref ou descarte foi executado.

## Método e limite da evidência

Foram usados `git rev-parse`, `git merge-base`, `git merge-base --is-ancestor`, `git rev-list`, `git diff --shortstat`, `git diff --name-status`, `git log`, `git cherry`, `git show --stat`, `git patch-id --stable`, `git worktree list` e `git branch -vv`. `git cherry main REF` com `+` identifica patch não presente por equivalência de patch-id em `main`; ausência de `+` não prova que o comportamento atual foi validado. A árvore de trabalho de `main` está suja com alterações de voz/documentação preexistentes; elas não foram tocadas e não contam como integração.

## Resultado executivo

- **Já integrado historicamente:** `codex/voice-architecture-audit` (`d3c97cbd`), `codex/voice-media-integration` (`c6fffbc1`), `codex/voice-migration-fix` (`8de44e30`), `codex/voice-unify-media-2026-08-29` (`ec47df9f`), `origin/implementacao-tokens` (`7018bc4e`), `origin/implementacao-tokens-copy` (`1daa09c7`), `origin/implementacao-tokens-voice-core` (`d3c97cbd`) e `origin/implementacao-tokens-voice-core-e2e-final` (`eb9e35dc`) são ancestrais de `main` nesta fotografia (`main..REF = 0`). Não há patch novo a cherry-pickar dessas pontas.
- **Não integrado por conteúdo:** nenhum patch genuinamente novo foi encontrado nas seis pontas. `codex/voice-media-bridge`, `codex/voice-pipecat-runtime`, `codex/voice-qa-ops`, `codex/voice-security-tests` e `codex/voice-stt-tts` aparecem como `-` em `git cherry main REF` e têm patch-id equivalente em commits de `main`; `codex/voice-crm-config` não é ancestral, mas seu conteúdo foi reaplicado semanticamente em `main` por `d8eb943b`.
- **Fora da Fase 1 estrita:** `origin/implementacao-tokens-channel-gateway` tem 5 commits fora do histórico (`main..REF = 5`), mas o primeiro (`9f84f3fe`) é funcionalmente representado em `main`; os quatro seguintes (`2b59dd3e`, `bb468c0b`, `08da2687`, `76dda2b1`) são candidatos genuinamente novos. Deve ser lote separado, depois da voz.

## Pontas únicas e conteúdo real

| Ordem sugerida | Ref / commit | Patch-id estável | Arquivos principais | Decisão |
|---|---|---|---|---|
| — | `codex/voice-media-bridge` / `231de183`, `71854bbf` | `e5850322d4410dc1138feb341a35463003d7acb9`; `49df9cdb7e37b37ca0bb48402a71dac94ad732e0` | cliente ARI, `rtp-media-bridge`, worker README e teste do iterador | **Já integrado:** equivalentes a `6c005ad4` e `e6163804` em `main`; não reaplicar. |
| — | `codex/voice-pipecat-runtime` / `2f497ab9` | `779322bdeca26a856358fcf304850581055a4a7a` | processo boundary, smoke/testes e README | **Já integrado por patch equivalente** em `30a01051`; não reaplicar. Real Pipecat continua `BLOCKED EXTERNAL`. |
| — | `codex/voice-stt-tts` / `fe1ca724` | `86d055fb6bb0b189c9a038b8b69815b0032092dc` | `runtime/adapter-boundary`, adapters Faster-Whisper, Kokoro e Piper, testes | **Já integrado por patch equivalente** (`7189ec9c` em `main`); não reaplicar. |
| — | `codex/voice-crm-config` / `84626e0c` | `dd0cb8e9e5950f6e6d7c3194bf13a8dc5a2ea7b2` | formulário tenant, contratos/schema, `tts-port`, OpenVoice/Kokoro/Piper | **Já integrado semanticamente** por `d8eb943b`; patch-id difere por contexto posterior. Não cherry-pickar. |
| — | `codex/voice-security-tests` / `55d52063` | `b27b4b5b5ce38405732a386e935fb54785d71b71` | rotas internas `/context` e `/event`, resolver de organização e testes | **Já integrado por patch equivalente** (`44a8e74e` em `main`); não reaplicar. |
| — | `codex/voice-qa-ops` / `49952a29` | `f90916b8c4007ea51bb3abd59e6cf8a51e21311d` | `verify-voice-qa.sh`, runbook, contrato de harness, `package.json` | **Já integrado historicamente** (`c6fffbc1` em `main`); não reaplicar. |

As pontas não ancestrais são duplicatas de conteúdo já aplicado. Há sobreposição textual entre `fe1ca724` e `84626e0c`, mas `main` já contém a combinação final: `30a01051` → `7189ec9c` → `d8eb943b`, com as correções posteriores de timeout/locale preservadas. A ordem de cherry-pick para esta fotografia é, portanto, **nenhuma**.

## Refs históricas já absorvidas

`git merge-base main REF` retornou o próprio tip para todas as refs seguintes, e `git rev-list --count main..REF` retornou `0`: `d3c97cbd`, `c6fffbc1`, `8de44e30`, `ec47df9f`, `7018bc4e`, `1daa09c7`, `eb9e35dc`. Isso prova alcançabilidade no histórico local, não prova que o código foi testado em produção, nem autoriza apagar branches/worktrees.

Em particular, `codex/voice-unify-media-2026-08-29` e `codex/voice-media-integration` não devem ser reaplicadas só porque os nomes aparecem no plano: os commits de loop RTP, integração SIP/STT/Agent OS/TTS e o gate de QA já estão na história alcançável de `main`. A confirmação futura deve usar `git log --ancestry-path` e o diff do checkout final, não novo cherry-pick.

## `origin/implementacao-tokens*`

- `origin/implementacao-tokens`, `origin/implementacao-tokens-copy`, `origin/implementacao-tokens-voice-core` e `origin/implementacao-tokens-voice-core-e2e-final`: ancestrais de `main`; não reaplicar.
- `origin/implementacao-tokens-channel-gateway` (`76dda2b1`) tem cinco commits fora da linha, altera `lib/channels/**` e `scripts/verify-implementacao-tokens-phase-02.sh`, e não é fatia de voz. O bootstrap `9f84f3fe` deve ser omitido por equivalência funcional; revisar seletivamente `2b59dd3e` (supervisor), `bb468c0b` + `08da2687` (identidade exata/fail-closed) e `76dda2b1` (trace/guardrails), nessa ordem.

## Worktrees e risco operacional

Todas as seis pontas únicas estão ligadas a worktrees ativos em `.worktrees/voice-*`. `codex/voice-migration-fix` aponta para `/private/tmp/voice-core-fix` e aparece `prunable`; isso é risco de perda de contexto, não autorização para prune. Preservar refs/worktrees até a integração ser aprovada e revalidada.

## Ordem exata proposta para uma futura consolidação autorizada

1. Congelar a fotografia e guardar o SHA de `main`; proteger a árvore suja existente.
2. Registrar as seis pontas como duplicatas: não executar cherry-pick.
3. Confirmar por `git range-diff`/patch-id os correspondentes em `main`: `6c005ad4`, `e6163804`, `30a01051`, `7189ec9c`, `d8eb943b`, `44a8e74e`, `c6fffbc1`.
4. Em branch de consolidação, executar os gates aplicáveis (`pnpm typecheck`, `pnpm lint`, testes unitários e `bash scripts/verify-voice-qa.sh provider-free`), registrando SHA e resultado. Não promover `NOT_PROVEN` a PASS real.
5. Só depois revisar `origin/implementacao-tokens-channel-gateway` como lote separado.

Esta é uma ordem de integração proposta, não uma operação executada.
