# Lumenva — finalização sem Docker

Estado inicial: toolchain canônica aprovada no CI, lockfile persistido. Todas
as mudanças seguintes ocorrem na branch `chore/lumenva-toolchain-canonicalization`.
Nenhum merge para `main` ou publicação em produção sem aprovação explícita.

## Regra arquitetural

**Zero Docker no estado-alvo.** Não instalar daemon, executar contêineres,
construir imagens ou depender de Compose como etapa necessária de CI, testes,
desenvolvimento ou deploy. Identificar artefatos legados e substituí-los antes
da sua retirada: nada de eliminar fluxos usados sem prova de paridade.

## Fases e gates

1. **PostgreSQL/RLS nativos.** Executar PostgreSQL 17 + pgvector via
   `initdb`/`pg_ctl`, cluster efêmero em loopback. Aplicar baseline, testar
   ACL/RLS, isolamento multitenant e cleanup. `pnpm test:db` deve falhar
   explicitamente se PostgreSQL não estiver disponível. Runner Ubuntu 24.04
   obtém os pacotes do PGDG, não de imagens.
2. **E2E sem contêiner.** Substituir o workflow legado de Supabase/Redis
   conteinerizados por: smoke/contratos com dublês determinísticos, mais E2E
   autenticado exclusivamente num projeto descartável explicitamente
   identificado e isolado. Não executar suites antigas contra produção.
   Garantir separação de fixtures, consentimento de limpeza e isolamento de
   Auth/Storage. O E2E real só fica verde depois de executar de fato.
3. **SDK/Sentry.** Atualizar imports depreciados e versões compatíveis com Next
   16, instrumentação, erros e source maps. Não enviar eventos de teste
   à organização real.
4. **Runtime/deploy nativo.** Substituir Dockerfiles/Compose e pipelines de
   imagem por distribuição versionada do bundle Node/Next, processos
   supervisionados, healthcheck, migração, backup, rollback e recuperação
   reproduzível. Dry-run primeiro, sem credencial de produção.
5. **Limpeza segura.** Auditar referências residuais a Docker (workflows
   `e2e.yml`, `gcp-ci.yml`, `publish-image.yml`, kit self-host, docs),
   desativar o legado somente quando a alternativa equivalente estiver
   validada. Revisar avisos Knip e Renovate sem esconder falhas.
6. **Gate final.** Checkout limpo + instalação congelada + versões + monorepo +
   repo-check + Knip + typecheck + lint + unitários + PostgreSQL/RLS nativo +
   E2E real + build de produção + simulação de deploy/rollback. Evidências
   por fase e lista de bloqueios com solução. PR apenas para revisão.

## Placeholders e limites de validação

Permitidos: URLs locais que não respondem, `*.invalid`, tokens fictícios
para mocks, Firebase Auth Emulator demo e chaves de cifra aleatórias geradas
apenas durante o job. Não versionar segredos. Não apontar fixture a produção.

**Placeholder não autentica contra Supabase/Redis/GCP reais.** Cenários
dependentes de serviço real exigem credenciais válidas de um ambiente
descartável. Na sua ausência, reportar o gate como bloqueado (nunca verde
por mock sem declarar que é mock).

## Situação do legado

O `test-db.sh` foi convertido para execução exclusivamente nativa. A prova
independente inicial passou em GitHub Actions run 36719306436 (PostgreSQL 17,
pgvector, baseline e invariantes sem contêiner), seguida pela integração do
bootstrap PGDG nos jobs RLS de CI. Os
workflows e recursos de deploy/E2E historicamente baseados em contêineres
continuam inventariados até existir substituição com paridade e prova.
Este documento não equivale a afirmar a migração integral concluída.

## Migração adicional — browser e artefatos

- `.github/workflows/e2e.yml` executa agora exclusivamente Playwright real
  no website público em Ubuntu nativo, sem `services`/daemon/segredos. Isto
  **não substitui** a cobertura autenticada do CRM: os specs permanecem no
  repositório, com a proteção `.env.e2e` local, e exigem um ambiente
  descartável isolado antes de serem promovidos ao CI.
- O antigo `.github/workflows/publish-image.yml` virou pacote tarball
  `.next/standalone` de validação, sem push/registry/deploy.
- O job GCP de imagem/container virou dry-run do pacote Node. Os testes RLS
  seguem nativos no gate separado. A limpeza posterior de Dockerfiles, Compose
  e self-host só é permitida depois da paridade de runtime, supervisão, secrets
  e recuperação, não apenas depois do tarball.

## Cloud Build e política permanente (fase nativa)

O `cloudbuild.yaml` antigo executava build/push de imagem e deploy de Cloud Run,
que exigem contêiner. Foi retirado da branch ativa: Cloud Run não é um alvo
nativo de Node. O `repo:check` passa a recusar qualquer novo workflow ativo
com `services:`, actions Docker, comandos Docker ou `supabase start`.
O import Sentry de `withSentryConfig` passou ao subpath `@sentry/nextjs/config`
para acompanhar o aviso emitido no build. Nenhum teste isolado gera eventos
na organização real. O arquivo histórico de documentação Cloud Run foi
substituído por instruções explícitas para pacote nativo e pré-requisitos de
produção ainda não homologados.
