# Revisão das branches remotas antigas — 2026-09-02

Escopo: refs `origin/*` após `git fetch origin`, excluindo `origin/main` e `origin/HEAD`. `main` auditada em `7ce0359b455ade96dbf8cbfbccbbfc4508709d1b` (inclui `26507491`). Para cada branch foi executado `git log --right-only --cherry-pick main...origin/<branch>`. Quando houve saída, os commits exclusivos foram inspecionados com `git show`/`git show --stat`; a contagem abaixo é a saída desse comando.

| Branch | Classificação | Resumo |
|---|---|---|
| `origin/agent-os-implementation-plan` | **ABANDONADA — segura pra apagar** | Branch de planejamento e fundação inicial do Agent OS (104 commits right-only), substituída pelas branches de fases e pelas integrações já feitas em `main`; não é uma linha de entrega atual. |
| `origin/agent-os-phase-2-kernel` | **TRABALHO REAL NÃO INTEGRADO** | Implementa o Agent Kernel (161 commits right-only), incluindo resolução de identidade, contexto, gateway de ferramentas, retries e contratos de segurança; a integração posterior em `main` não torna os commits finais desta ref equivalentes por cherry-pick. |
| `origin/agent-os-phase-3-product-agents` | **TRABALHO REAL NÃO INTEGRADO** | Implementa os agentes de produto e seus contratos/testes (191 commits right-only), com verificações finais próprias ainda ausentes como commits equivalentes em `main`. |
| `origin/agent-os-phase-4-shadow-evals` | **TRABALHO REAL NÃO INTEGRADO** | Implementa shadow evaluations e replay histórico (230 commits right-only), incluindo comando, testes RED/GREEN e evidência da fase; requer decisão antes de descartar a ref. |
| `origin/agent-os-phase-4-shadow-evals-planning` | **ABANDONADA — segura pra apagar** | É uma linha de desenho/planejamento da Phase 4 (192 commits right-only) que foi sucedida pela branch de implementação `agent-os-phase-4-shadow-evals` e pela integração posterior do Agent OS. |
| `origin/agent-os-phase-5-assisted-autonomy` | **TRABALHO REAL NÃO INTEGRADO** | Implementa autonomia assistida, aprovações, rollback, drafts sem side effect e evidência de promoção (165 commits right-only); os commits finais da branch não têm equivalente por cherry-pick em `main`. |
| `origin/agent-os-phase-6-learning-flywheel` | **TRABALHO REAL NÃO INTEGRADO** | Implementa o learning flywheel governado, fila de propostas, validação em camadas e promoção (244 commits right-only), além de migração/teste de tipos no topo da branch. |
| `origin/agent-os-phase-7-durable-benchmark` | **TRABALHO REAL NÃO INTEGRADO** | Implementa benchmark durável/comparativo e integração Inngest (230 commits right-only); o topo ainda contém o fix de lint `f40725a3`, que não aparece como equivalente em `main`. |
| `origin/agent-os-verification` | **TRABALHO REAL NÃO INTEGRADO** | Contém verificação e UI da fila de revisão da Phase 6, além de correções de validação UUID (218 commits right-only); é material de produto/verificação, não mero marcador descartável. |
| `origin/codex/crm-consolidated` | **JÁ INTEGRADA — segura pra apagar** | Não há commits right-only; o fix de voz no topo já tem equivalente em `main`. |
| `origin/dependabot/npm_and_yarn/gpt-tokenizer-4.0.0` | **TRABALHO REAL NÃO INTEGRADO** | Atualiza `gpt-tokenizer` de 3.4.0 para 4.0.0 e o lockfile (1 commit); depende de decisão/teste de compatibilidade antes de integrar ou apagar. |
| `origin/dependabot/npm_and_yarn/minor-and-patch-cc63521167` | **TRABALHO REAL NÃO INTEGRADO** | Propõe 33 atualizações minor/patch em `package.json` e `pnpm-lock.yaml` (1 commit); é uma atualização ampla ainda não integrada e requer decisão. |
| `origin/docs/complete-doc-sync` | **JÁ INTEGRADA — segura pra apagar** | Não há commits right-only. |
| `origin/docs/dead-cache-doc-refs` | **JÁ INTEGRADA — segura pra apagar** | Não há commits right-only. |
| `origin/fix/inbox-item-severity-vocab` | **JÁ INTEGRADA — segura pra apagar** | Não há commits right-only. |
| `origin/fix/squad-e2e-handoff-continuity` | **JÁ INTEGRADA — segura pra apagar** | Não há commits right-only. |
| `origin/gpt-lumenva-content-os` | **JÁ INTEGRADA — segura pra apagar** | Não há commits right-only. |
| `origin/implementacao-tokens` | **JÁ INTEGRADA — segura pra apagar** | Não há commits right-only. |
| `origin/implementacao-tokens-channel-gateway` | **TRABALHO REAL NÃO INTEGRADO** | Os 3 commits adicionam contratos de gateway de canais, identidade externa, supervisão de saúde/recuperação, rastreio e guardrails de segurança/tenant; código e testes ainda não têm equivalente em `main`. |
| `origin/implementacao-tokens-copy` | **JÁ INTEGRADA — segura pra apagar** | Não há commits right-only. |
| `origin/implementacao-tokens-voice-core` | **JÁ INTEGRADA — segura pra apagar** | Não há commits right-only. |
| `origin/implementacao-tokens-voice-core-e2e-final` | **JÁ INTEGRADA — segura pra apagar** | Não há commits right-only. |
| `origin/sync/upstream-cherrypicks` | **JÁ INTEGRADA — segura pra apagar** | Não há commits right-only. |

## Seguras para apagar com autorização

Estas refs têm saída vazia no `git log --right-only --cherry-pick` ou são planos explicitamente substituídos:

- `origin/agent-os-implementation-plan`
- `origin/agent-os-phase-4-shadow-evals-planning`
- `origin/codex/crm-consolidated`
- `origin/docs/complete-doc-sync`
- `origin/docs/dead-cache-doc-refs`
- `origin/fix/inbox-item-severity-vocab`
- `origin/fix/squad-e2e-handoff-continuity`
- `origin/gpt-lumenva-content-os`
- `origin/implementacao-tokens`
- `origin/implementacao-tokens-copy`
- `origin/implementacao-tokens-voice-core`
- `origin/implementacao-tokens-voice-core-e2e-final`
- `origin/sync/upstream-cherrypicks`

## Precisam de decisão do dono

- `origin/agent-os-phase-2-kernel`
- `origin/agent-os-phase-3-product-agents`
- `origin/agent-os-phase-4-shadow-evals`
- `origin/agent-os-phase-5-assisted-autonomy`
- `origin/agent-os-phase-6-learning-flywheel`
- `origin/agent-os-phase-7-durable-benchmark`
- `origin/agent-os-verification`
- `origin/dependabot/npm_and_yarn/gpt-tokenizer-4.0.0`
- `origin/dependabot/npm_and_yarn/minor-and-patch-cc63521167`
- `origin/implementacao-tokens-channel-gateway`

Nenhuma branch remota foi apagada, e nenhum `push --delete` foi executado.
