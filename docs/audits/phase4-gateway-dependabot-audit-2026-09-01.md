# Auditoria Fase 4 — Gateway e Dependabot

**Data:** 2026-09-01  
**Checkout:** `/Users/david/Desktop/CRM/DeskcommCRM`  
**Escopo:** leitura de refs Git e arquivos versionados; nenhum merge, rebase, cherry-pick, fetch, push, checkout ou remoção foi executado.

## Fotografia Git

- `main` = `5336a6a8f7ebda373938fdb7148206b624a2de61`; worktree já estava sujo antes da auditoria.
- `origin/implementacao-tokens-channel-gateway` = `76dda2b17702cfd5ba847e62468b038b534cb597`; cinco commits exclusivos segundo `git cherry main REF`.
- `origin/dependabot/npm_and_yarn/gpt-tokenizer-4.0.0` = `775b1f3e32b5cb2fbe62381a70c9eebb0f0d1aae`; um commit exclusivo.
- `origin/dependabot/npm_and_yarn/minor-and-patch-cc63521167` = `8113eedc8c9314893914e700f4a87c0f00c924e2`; um commit exclusivo.

As branches Dependabot têm como pais `b798fafe` e `6f8cfcf2`, respectivamente; `main` avançou depois deles. A comparação de três pontos (`main...REF`) mostra apenas o patch Dependabot, mas a comparação de dois pontos revela que não se deve fazer merge direto dessas linhas antigas: elas carregam história divergente e, no caso do gateway, removem grande quantidade de trabalho posterior de voz/documentação.

## 1. Gateway de canais

### Conteúdo

Os cinco commits são:

1. `9f84f3fe` — contratos de gateway, engines WAHA/Meta Cloud, registry e testes de seam.
2. `2b59dd3e` — supervisor de saúde, leases e recuperação de sessão.
3. `bb468c0b` — resolução exata de identidade externa.
4. `08da2687` — resolução fail-closed para identidade ambígua/inexata.
5. `76dda2b1` — trace, sanitização de logs, escopo de tenant e autorização de ferramentas.

O conjunto acrescenta 19 arquivos, 1.574 linhas líquidas no diff de três pontos, incluindo seis famílias de testes. A suíte cobre contratos, engines sem rede, identidade, segurança, trace e supervisor. O script versionado `scripts/verify-implementacao-tokens-phase-02.sh` declara estes gates: `typecheck`, testes Vitest selecionados, `lint:channels`, `lint:tenant-filter` e `next build`.

### Riscos e integração

`main` já contém os arquivos-base de `lib/channels/gateway/` (capabilities, contracts, engine, errors, registry e types), mas não contém `identity-resolver`, `security`, `session-supervisor` nem `trace`. Portanto, o tip do gateway não é uma linha que possa ser mesclada: `git diff main REF` mostra 256 arquivos alterados, com remoções de rotas, documentação e runtime de voz que não pertencem à Fase 4. O bootstrap também modifica arquivos que já evoluíram em `main`; cherry-pick cego causaria conflitos ou regressões.

**Recomendação:** **cherry-pick seletivo**, em branch de consolidação criado a partir do `main` atual. Portar e revisar primeiro os commits de supervisor/identidade/segurança/trace (`2b59dd3e`, `bb468c0b`, `08da2687`, `76dda2b1`); tratar `9f84f3fe` como comparação de contratos, não como merge automático. Preservar as versões atuais de `main` dos arquivos-base e resolver exports/testes manualmente. Não fazer merge da branch inteira.

### Testes e prova

O script é intenção versionada, não resultado. Não há saída de CI nos refs auditados. Não executei os gates porque a autorização restringiu a auditoria a leitura de Git e o checkout estava sujo. Logo, o gateway permanece `NOT_PROVEN` até rodar os gates no SHA final; `next build` e testes declarados ainda não têm resultado nesta fotografia. A suíte não substitui `test:db`, `test:e2e` ou prova de integração real de WAHA/Meta Cloud.

### Licenciamento

Não há nova dependência nem código externo copiado no diff do gateway. Os engines usam adapters já pertencentes ao repositório. A exigência documental de verificar licenças de engines não é reaberta por estes commits; ainda assim, qualquer engine não oficial adicionada posteriormente deve ser registrada em `docs/licenses/channel-engine-dependencies.md` antes de integração.

## 2. Dependabot — `gpt-tokenizer-4.0.0`

Commit `775b1f3e` altera somente `package.json` e `pnpm-lock.yaml`: `gpt-tokenizer` `^3.4.0 → ^4.0.0`. O lockfile atualiza a resolução para `4.0.0`, as referências peer de LlamaIndex e `es-module-lexer` `2.3.1 → 2.3.2`; não há código ou testes novos. `git cherry main REF` confirma que o patch não está em `main`.

O lockfile contém integridade para `gpt-tokenizer@4.0.0`, mas não há resultado de instalação, typecheck, lint, testes ou build para essa versão. A instalação existente no checkout é `gpt-tokenizer@3.4.0` e não prova a branch. O pacote `4.0.0` declara MIT e o repositório contém licença MIT; não há bloqueio de licenciamento identificado.

Há risco funcional específico: `lib/ui/TokenCounter.tsx` importa `encode` do entrypoint raiz e a documentação do projeto exige compatibilidade com `cl100k_base`, enquanto a versão 4 usa `o200k_base` como padrão no import raiz. Sem selecionar explicitamente `cl100k_base` e sem teste de regressão do contador/limiares, a atualização pode alterar silenciosamente a contagem de tokens. A versão 4 também remove bundles UMD/entrypoint global, mudança que deve ser verificada para o bundle cliente.

**Recomendação:** **fechar** este branch/PR como unidade histórica. Se a atualização continuar necessária, reabrir a partir de `main` atual, verificar a API de `gpt-tokenizer@4.0.0`, licença exata e executar `pnpm install --frozen-lockfile`, `typecheck`, `lint`, `test:unit`, `test:db` quando aplicável e `build`. Não cherry-pickar o commit antigo sem essa validação.

## 3. Dependabot — `minor-and-patch-cc63521167`

Commit `8113eedc` agrupa 33 atualizações diretas em `package.json` e muda 2.320 linhas do lockfile. Entre elas estão `ai` `7.0.52 → 7.0.83`, SDKs Anthropic/Google/OpenAI, LangChain/LangGraph, Next.js `16.3.0 → 16.3.3`, Supabase, React Query, Sentry, Resend, React PDF, TypeScript ESLint, Vite e Vitest. `langsmith` passa de `0.8.9` para `0.9.0`, uma mudança semântica relevante dentro da série `0.x`. O patch é exclusivo de `main` e não altera código de aplicação.

O lockfile tem hashes de integridade e resoluções coerentes com os novos importers, mas não existe CI ou execução local contra esse conjunto. `node_modules` contém versões anteriores e não prova o branch. O manifesto/lockfile não registra licenças; as versões atualmente instaladas verificadas localmente são MIT, Apache-2.0 ou ISC, mas isso não comprova as versões propostas nem todas as transitivas.

**Recomendação:** **fechar** este branch/PR. O agrupamento é amplo demais para atribuir regressões, está baseado em `6f8cfcf2` e não tem gates verdes comprovados. Se ainda houver valor, recriar a atualização a partir do `main` atual em lotes menores, com verificação de licença exata por pacote e execução de `pnpm install --frozen-lockfile`, `typecheck`, `lint`, `lint:channels`, `test:harness`, `harness:check`, `test:unit`, `test:shell`, `test:db` e `build`.

## Conclusão

O único candidato a reaproveitamento é o gateway, por **cherry-pick seletivo e revisão de conflitos**. Os dois Dependabot devem ser **fechados** e reabertos de forma incremental se as atualizações continuarem necessárias. Nenhum dos três refs tem prova suficiente para declarar integração funcional, CI verde ou licenciamento completo das versões-alvo.

**Estado:** análise concluída; nenhuma operação Git mutável foi executada.
