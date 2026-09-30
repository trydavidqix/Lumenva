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

O `test-db.sh` foi convertido para execução exclusivamente nativa. Os
workflows e recursos de deploy/E2E historicamente baseados em contêineres
continuam inventariados até existir substituição com paridade e prova.
Este documento não equivale a afirmar a migração integral concluída.
