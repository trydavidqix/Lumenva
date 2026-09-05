# Auditoria Fase 4 — Gateway e Dependabot

Data da fotografia: 2026-09-01  
Checkout auditado: `/Users/david/Desktop/Projetos/CRM/DeskcommCRM`  
Base: `main` em `5336a6a8f7ebda373938fdb7148206b624a2de61`  
Escopo: somente leitura de Git; não foram executados merge, rebase, cherry-pick, push, fetch, checkout ou remoção de refs.

## Resumo executivo

`origin/implementacao-tokens-channel-gateway` (`76dda2b1`, cinco commits) contém valor funcional, mas não deve ser integrado por merge inteiro: `main` já incorporou a fundação dos contratos/engines em commits com outras evoluções posteriores. Recomendação: cherry-pick seletivo, em branch temporária, dos quatro commits que adicionam supervisor, resolução exata de identidade, correção fail-closed, segurança e trace; revisar conflitos em `lib/channels/index.ts` e no script de gate. O gate completo da branch não foi comprovado: a tentativa dos testes focados expirou após 30 segundos sem resultado.

`origin/dependabot/npm_and_yarn/gpt-tokenizer-4.0.0` (`775b1f3e`) é uma atualização semver major de `gpt-tokenizer` 3.4.0 para 4.0.0, afetando também os snapshots transitivos do LlamaIndex. Recomendação: fechar esta ponta antiga e reabrir/regenerar contra `main`, ou cherry-pick somente após gate explícito de `TokenCounter` e LlamaIndex. Não há teste, licença ou resultado CI registrado no commit.

`origin/dependabot/npm_and_yarn/minor-and-patch-cc63521167` (`8113eedc`) agrupa 33 atualizações de produção e desenvolvimento, incluindo `next` 16.3.0→16.3.3, `ai` 7.0.52→7.0.83, `langsmith` 0.8.9→0.9.0, `react-hook-form` 7.84.0→7.86.0, Vitest/Vite, Supabase e LangChain. Recomendação: fechar a ponta agrupada e recriar atualizações menores contra `main`; não fazer cherry-pick do lote sem executar a matriz completa de typecheck, lint, unit, build, E2E e revisão de compatibilidade. Não há teste, licença ou resultado CI registrado no commit.

## Evidência Git

Comandos executados no checkout correto:

```text
git rev-parse --show-toplevel
/Users/david/Desktop/Projetos/CRM/DeskcommCRM

git status --short --branch
## main...origin/main [ahead 15]
M docs/current-state.md
... alterações de voz/documentação já existentes; preservadas

git show-ref --verify refs/remotes/origin/implementacao-tokens-channel-gateway
76dda2b17702cfd5ba847e62468b038b534cb597

git show-ref --verify refs/remotes/origin/dependabot/npm_and_yarn/gpt-tokenizer-4.0.0
775b1f3e32b5cb2fbe62381a70c9eebb0f0d1aae

git show-ref --verify refs/remotes/origin/dependabot/npm_and_yarn/minor-and-patch-cc63521167
8113eedc8c9314893914e700f4a87c0f00c924e2
```

Contra `main`, `git rev-list --count main..REF`, `git diff --shortstat main...REF` e `git cherry main REF` produziram:

| Ref | Commits | Diff contra o ponto de divergência | Resultado de `git cherry` |
|---|---:|---|---|
| Gateway | 5 | 19 arquivos, 1574 inserções, 5 remoções | cinco commits `+` |
| Tokenizer | 1 | 2 arquivos, 29 inserções, 23 remoções | um commit `+` |
| Grupo | 1 | 2 arquivos, 1174 inserções, 1210 remoções | um commit `+` |

O gateway tem estes commits exclusivos pela topologia observada:

```text
9f84f3fe feat(channels): bootstrap owned channel gateway contracts
2b59dd3e feat(channels): supervise session health and recovery
bb468c0b feat(channels): resolve exact external channel identities
08da2687 fix(channels): keep exact identity resolution fail closed
76dda2b1 feat(channels): add gateway trace and security guardrails
```

`main` já contém a fundação equivalente, mas evoluída, em `90e2fc49`, `54f423a5`, `d2ea13ac`, `0b09f3e9`, `bd516151`, `fca66e47`, `4e22bc7f`, `b153f5a2`, `55d74fe2`, `c11ed037`, `bc766627` e `af9d897f`. O diff direto branch→main confirma sobreposição em engines, contratos, registry, testes e exports; portanto merge inteiro arriscaria regredir a implementação atual.

## Gateway: conteúdo, testes e riscos

Os quatro acréscimos funcionais posteriores à fundação são:

- supervisor de saúde/lease e recuperação sem migração automática de engine;
- resolução exata de identidade por organização, canal, conta e candidatos conservadores;
- guardrails de tenant, autorização de ferramentas, conteúdo externo não confiável e sanitização de logs;
- contexto/eventos de trace com continuidade por `traceId`.

Há seis arquivos de teste focados na ponta (`channel-seam`, engines existentes, contracts, session-supervisor, identity-resolver e security), com 29 ocorrências de `it(`/`test(` na fotografia. O script `scripts/verify-implementacao-tokens-phase-02.sh` também prescreve `pnpm typecheck`, esses testes, `pnpm lint:channels`, `pnpm lint:tenant-filter` e `pnpm next build`. A execução em uma árvore temporária exportada do SHA da branch, usando o `node_modules` já existente, expirou em 30 segundos antes de produzir resultado; isso é `NOT_PROVEN`, não PASS.

Riscos para o cherry-pick seletivo:

- `lib/channels/index.ts` e o script de gate foram alterados pela branch e por `main`; resolver manualmente preservando os exports/evoluções atuais.
- A branch não implementa persistência de contas/sessões/eventos/outbox nem integração real de transporte; é contrato/guardrail, não gateway operacional completo.
- A sanitização de logs depende de chamadas explícitas a `sanitizeGatewayLogContext`; `traceEvent` preserva `metadata` sem sanitizar. O consumidor deve aplicar a fronteira antes de registrar metadata.
- O supervisor classifica sinais e escolhe ação, mas não contém worker, lease distribuído ou reconexão efetiva. Os testes não provam operação externa.
- A resolução é fail-closed para identidade vazia, não encontrada ou ambígua, mas a segurança de `IdentityRepository` permanece responsabilidade do adaptador persistente futuro.

## Dependabot: testes e licenciamento

Os dois commits alteram somente `package.json` e `pnpm-lock.yaml`; nenhum arquivo de teste, configuração de CI, `LICENSE`, `NOTICE` ou `docs/licenses/*` é alterado. A árvore contém a licença do produto, mas o lockfile não é inventário de licença e os commits não registram verificação legal. Assim, licenciamento dos pacotes atualizados e de seus transitivos fica `NOT_PROVEN`; exige scanner/manifesto de licenças após instalar exatamente as versões-alvo.

O plano do gateway também mantém desmarcada a verificação da licença do engine não oficial e aponta a criação de `docs/licenses/channel-engine-dependencies.md`; esse arquivo não existe na árvore da branch. Isso não bloqueia os dois upgrades genéricos por si só, mas impede declarar a Fase 4 inteira fechada.

## Decisão

1. Gateway: **cherry-pick seletivo**, não merge amplo. Priorizar `2b59dd3e`, `bb468c0b`, `08da2687` e `76dda2b1`, após aplicar em branch temporária sobre `main`, resolver exports/script e executar os gates. Reavaliar `9f84f3fe` somente se algum contrato ainda faltar, pois sua fundação já está representada em `main`.
2. `gpt-tokenizer-4.0.0`: **fechar a ponta antiga** e recriar contra `main`; se o proprietário exigir aproveitamento imediato, cherry-pick isolado apenas com testes de `lib/ui/TokenCounter.tsx`, consumidores de `encode` e LlamaIndex. É semver major e não há prova de compatibilidade nesta fotografia.
3. `minor-and-patch-cc63521167`: **fechar a ponta agrupada** e reabrir atualizações menores/por família contra `main`. O lote mistura runtime, framework, SDKs e ferramentas de teste; não é seguro cherry-pickar como unidade sem regressão completa.

