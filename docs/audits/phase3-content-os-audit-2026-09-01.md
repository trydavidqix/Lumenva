# Auditoria Fase 3 — Content OS

**Data:** 2026-09-01  
**Checkout:** `/Users/david/Desktop/Projetos/CRM/DeskcommCRM`  
**Escopo:** somente leitura de Git e dos arquivos versionados; nenhuma operação de integração foi executada.

## Estado das refs

- `gpt-lumenva-content-os` local e `origin/gpt-lumenva-content-os` apontam exatamente para `cda205c9cb2a178f3450e87fec932601dc58948c` (`feat(content-os): add curated intelligence sources`). `git diff --quiet` entre as duas refs retornou `0`.
- A ponta não está incorporada em `main` (`main` = `5336a6a8f7ebda373938fdb7148206b624a2de61`); os testes de ancestralidade deram `main -> Content OS: 1` e `Content OS -> main: 1`.
- `main..gpt-lumenva-content-os`: **24 commits**, **42 arquivos**, **7.181 linhas adicionadas** (`git diff --shortstat`). A série contém um merge de `origin/main` no commit `f343ed3e`; portanto, a contagem é histórica da branch e não deve ser tratada como 24 patches independentes para cherry-pick cego.
- A branch está ligada ao worktree ativo `.worktrees/gpt-lumenva-content-os`; preservar esse worktree até decisão do responsável.

## Escopo do lote

O diff introduz a Spec 17, planos/design do Content OS, 22 tabelas tenant-aware, tipos gerados, uma migration (`20260814082914_content_os_foundation.sql`), apêndice no `supabase/baseline.sql`, registro no `MANIFEST.md`, contratos de providers, adapters RSSHub/changedetection e testes unitários/invariantes.

Não há arquivos `lib/content-os/**` ou a Spec 17 em `main`. O único caminho compartilhado com `agent-os-phase-7-durable-benchmark` é `lib/database.types.ts`; o outro é `supabase/migrations/MANIFEST.md`. Esse é o conflito mecânico esperado ao integrar Content OS depois de Agent OS, não evidência de dependência funcional entre os domínios.

## Revisão de conflitos e contratos

### Event log — bloqueador de integração a resolver

1. O `event_log` canónico do CRM impõe `event_type` com regex de **dois segmentos** (`^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$`) em `supabase/baseline.sql:1557`. A lista Content OS usa eventos de **três segmentos**, por exemplo `content.signal.collected`, e o repositório em `lib/content-os/intelligence/supabase-repository.ts` grava esses valores diretamente em `event_log`. Se executado como está, o insert viola `event_type_format`.
2. `lib/content-os/events.ts:3-18` adiciona `content.source_collection_requested` e `content.competitor_check_requested`, mas a Spec 17 lista como eventos iniciais somente os 13 eventos a partir de `content.signal.collected` (`docs/specs/17-spec-content-os.md:410-425`), e `tests/unit/content-os-events.test.ts:10-24` espera exatamente esses 13. Há divergência interna entre implementação, teste e spec; o teste canónico falhará antes de qualquer integração funcional.
3. Os payloads Zod usam `organizationId/entityId/requestId` em camelCase (`lib/content-os/events.ts:21-29`), enquanto a convenção da API é snake_case. Isso pode ser aceitável para um tipo interno, mas precisa ser explicitamente separado do payload persistido em `event_log`; hoje o repository grava apenas `organizationId/entityId` e descarta `requestId` do payload.

### Provider boundaries e SSRF

- Os clientes mantêm credenciais server-side e fazem validação de rota RSSHub e de `watchId` changedetection.
- A Spec 17 exige validação anti-SSRF para URLs externas (`docs/specs/17-spec-content-os.md:357-368`), porém `CompetitorService.createMonitor` aceita `targetUrl` e chama `changedetection.createWatch` sem validação de esquema, host, rede privada ou metadata endpoint (`lib/content-os/intelligence/competitor-service.ts`). O adapter remoto não substitui essa validação de entrada do domínio. Deve ser resolvido antes de expor criação de monitor.
- Não há provider de distribuição Postiz implementado neste lote; existem apenas contratos/stubs. A integração deve manter isso como superfície não implementada, sem alegar publicação funcional.

### Schema/RLS e fronteiras de tenant

- A migration cria 22 tabelas e habilita RLS/policy `organization_id` para todas; o teste de invariantes cobre existência, RLS e leitura cross-tenant de campanhas.
- As FKs entre tabelas Content OS carregam somente o identificador do pai (por exemplo `content_signals.source_id`, `content_ideas.campaign_id`, `publication_jobs.connection_id`) sem uma constraint composta que force o `organization_id` do pai a coincidir. RLS bloqueia leitura normal, mas a migration não prova integridade cross-tenant no nível relacional. Antes de integração, decidir se o contrato exige FKs compostas/trigger de coerência ou se todos os writers confiáveis garantirão essa condição; adicionar um teste de tentativa cross-tenant se a decisão for manter o desenho atual.
- `baseline.sql`, `database.types.ts` e `MANIFEST.md` são os pontos de colisão com Agent OS e devem ser regenerados/revisados no checkout final, nunca resolvidos escolhendo automaticamente um lado.

## Patch e decisão recomendada

- Não há patch-id duplicado evidente dentro da série; os 24 commits formam uma linha Content OS coerente, com o merge de `origin/main` no meio.
- Como local e remoto têm a mesma ponta, escolher uma única ref canónica (`cda205c9…`) e não integrar ambas.
- Fazer a integração como **um lote único** numa branch de consolidação limpa, depois de resolver os três itens bloqueadores: (a) vocabulário/formato de `event_log` e teste divergente; (b) validação anti-SSRF de `targetUrl`; (c) decisão/teste de coerência cross-tenant das FKs. Na resolução mecânica, preservar o conteúdo de ambos os lados em `lib/database.types.ts` e inserir a linha Content OS no `MANIFEST.md` sem reordenar ou apagar o histórico Agent OS.
- Após aprovação, executar os gates correspondentes no SHA final (`pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:db` por tocar schema/RLS e `pnpm lint:channels` se os providers forem ligados). Esta auditoria não executou esses gates.

## Conclusão

**Estado:** candidato a integração em lote único, mas **não pronto para integração sem correções/decisões dos conflitos acima**. Nenhum merge, rebase, cherry-pick, fetch, push, checkout, remoção de ref ou alteração de código foi executado.

