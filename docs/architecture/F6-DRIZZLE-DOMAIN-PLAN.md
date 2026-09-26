# F6 — Drizzle por domínio: contrato de shadow reads e promoção

**Status:** design aprovado para implementação incremental; este gate não executa migração, não altera schema, não habilita produção e não abre sessão Jules.

**Objetivo:** substituir a leitura de um domínio por vez, mantendo o caminho Supabase/Postgres atual como autoridade até que a leitura Drizzle tenha evidência comparável, tenant-safe e reversível. A conexão Drizzle existente em `packages/core/social-brain/db/src/gcp/cloud-sql.ts` é apenas a fundação de transporte; ela não é, sozinha, uma migração de repositórios.

## 1. Limites do gate F6-C0

Este documento define interfaces, normalização, política de mismatch, flags, rollback e critérios de promoção. Não cria tabelas, não edita `infra/supabase/migrations/`, `infra/supabase/baseline.sql`, `MANIFEST.md`, RLS, credenciais ou handlers de produção.

Qualquer mudança futura de schema seguirá `.claude/rules/database-migrations.md`: migration versionada + apêndice idempotente em `baseline.sql` + entrada no `MANIFEST.md`. F6-C0 não precisa dessa tripla porque não muda schema.

Evidência atual observada:

- `packages/core/social-brain/db/src/gcp/cloud-sql.ts` exporta uma instância Drizzle sobre `pg`, mas os repositórios de domínio atuais ainda usam Supabase typed clients.
- `packages/core/social-brain/db/src/tenant/` contém os contratos F1/F2 de identidade, tenant e RLS; eles permanecem fonte única da verdade.
- O alvo é Cloud SQL/Postgres compatível. Drizzle não ganha permissão para ignorar RLS, RBAC, filtro manual de tenant ou auditoria.

## 2. Matriz de domínios e ordem de promoção

| Domínio | Caminho atual a preservar | Alvo Drizzle | Primeira leitura shadow | Escrita no primeiro corte | Risco | Critério de promoção |
|---|---|---|---|---|---|---|
| CRM/Leads | repositórios CRM existentes e consultas tenant-scoped | `apps/crm/lib/db/drizzle/domains/crm/` | contatos, leads e paginação | Não | Médio | zero mismatch de tenant/RBAC; campos normalizados iguais; timeout dentro do orçamento |
| Conversations/Messages/Media | repositórios de conversas/mensagens e `ObjectStore` separado | `apps/crm/lib/db/drizzle/domains/messaging/` | conversa visível, mensagens e metadados; mídia só por locator | Não | Alto | zero mismatch de visibility/role/tenant; nenhuma chamada de storage no caminho negado |
| Identity/Tenant | F1/F2, memberships, organizações e contexto | Adaptador read-only depois de CRM | somente resolução já autorizada | Não | Crítico | zero divergência de identidade, organização ou papel; revisão Codex obrigatória |
| Channels/Integrations | repositórios de sessões e configurações de canal | adaptador de domínio após CRM | estado não-secreto e status | Não | Alto | credenciais nunca comparadas/logadas; tenant e auditoria preservados |
| Content/Social publishing | repositórios de conteúdo, publicação e mídia | adaptador após messaging | metadados e estados | Não | Alto | nenhum efeito externo; idempotência e estado normalizados |
| Audit/Jobs/Analytics | repositórios append-only, jobs e métricas | adaptador dedicado posterior | somente leitura de evidência | Não | Alto | retenção, tenant, redaction e ordem preservados |

A ordem inicial é CRM/Leads → Conversations/Messages/Media → os demais domínios. O domínio Identity/Tenant não será promovido automaticamente: qualquer diferença de identidade, organização, papel, visibilidade ou autorização é bloqueadora, mesmo que o valor funcional pareça equivalente.

## 3. Interfaces equivalentes

O adaptador Drizzle deve implementar a mesma intenção de domínio, não copiar chamadas Supabase:

```ts
type TenantReadContext = {
  userId: string
  organizationId: string
  role: 'viewer' | 'agent' | 'manager' | 'admin'
  requestId: string
}

interface DomainRepository<Row, Filter, Create, Patch> {
  findById(ctx: TenantReadContext, id: string): Promise<Row | null>
  list(ctx: TenantReadContext, filter: Filter): Promise<readonly Row[]>
  insert(ctx: TenantReadContext, input: Create): Promise<Row>
  update(ctx: TenantReadContext, id: string, patch: Patch): Promise<Row>
  delete(ctx: TenantReadContext, id: string): Promise<void>
}
```

Regras do contrato:

1. `TenantReadContext` é resolvido no servidor; `organization_id` recebido do body/query/path é apenas candidato.
2. Toda query tenant-scoped exige contexto válido antes de executar SQL.
3. O contexto da transação usa `SET LOCAL app.organization_id`, nunca `SET` session-level em pool reutilizado.
4. A role SQL não pode ter `BYPASSRLS`; o caminho administrativo explícito precisa filtrar organização, papel e auditoria manualmente.
5. O adaptador não exporta tipos de SDK Supabase/Drizzle para o domínio; converte para tipos canônicos e mantém snake_case na fronteira SQL.
6. Writes ficam fora do primeiro shadow rollout. Nenhuma comparação pode duplicar side effect, disparar webhook, enviar mensagem ou chamar storage.

## 4. Normalização e comparação

Cada domínio publica um `DomainNormalizer<Row, Canonical>` versionado junto do adaptador. A normalização:

- converte `null` e ausência somente quando o contrato do campo diz que são equivalentes;
- ordena listas por chave estável, nunca pela ordem incidental do banco;
- converte timestamps para UTC ISO e números para a precisão canônica;
- compara enumerações e `organization_id` exatamente;
- remove apenas campos explicitamente voláteis, nunca identidade, papel, visibilidade, ownership, estado, checksum ou valor financeiro;
- não registra payload, token, conteúdo de mensagem ou PII.

Mismatches são classificados como `missing`, `extra`, `field`, `ordering`, `timeout`, `error` ou `authorization`. `authorization`, `tenant`, `identity`, `visibility` e qualquer erro de filtro são sempre severidade bloqueadora. Timeout/erro de shadow não altera o resultado primário, mas conta na métrica e impede promoção até ter causa conhecida.

## 5. Shadow reads, flags e rollback

Estados permitidos por domínio e organização:

- `off`: somente caminho legado; nenhum shadow call.
- `observe`: legado é resposta; Drizzle roda em paralelo com timeout curto e resultado só vai para métrica redigida.
- `sampled`: igual a `observe`, limitado a allowlist de organizações e amostra determinística.
- `enforced`: somente depois de F6-C1; Drizzle responde e o legado continua disponível como fallback controlado.

O default é `off`. A flag precisa ser server-side, auditável, tenant-scoped e fail-closed: flag ausente, configuração inválida ou erro de avaliação retorna a rota ao legado sem habilitar Drizzle. Não existe flag client-side para escolher banco.

Rollback instantâneo é a troca de `enforced/observe/sampled` para `off` por domínio e organização. O rollback não desfaz schema nem executa write reverso. Critérios automáticos para desligar shadow: mismatch de tenant/RBAC/identity, aumento de erro acima do orçamento, latência fora do limite acordado, ou qualquer risco de efeito externo. A decisão fica em log estruturado sem segredo/PII e em auditoria quando altera rollout.

## 6. Promoção por domínio

F6-C1 só pode promover um domínio quando todos os itens abaixo tiverem evidência:

1. matriz A/B de duas organizações, quatro papéis e caminho platform_admin explícito;
2. lista, busca, paginação, agregação, leitura por ID, insert/update/delete e not-found cross-tenant cobertos onde o domínio permitir;
3. RLS e filtro app-level produzem o mesmo conjunto;
4. pool reutilizado não vaza `SET LOCAL` entre transações;
5. mismatch normalizado zero para identidade/tenant/RBAC e zero mismatch não-explicado nos casos funcionais;
6. timeout, erro, retry, idempotência e rollback exercitados sem side effect duplicado;
7. baseline fresh, migrations e reapply validados se — e somente se — houve mudança de schema;
8. `pnpm test:db`, invariants e validação do PR executados nos canais disponíveis conforme `.claude/rules/testing-verification.md`.

F6-C1 é Codex-only para qualquer mudança de schema, RLS, role SQL, cutover de escrita ou interpretação de mismatch de autorização. F6-H1 fica por último e exige ação do Owner para ativar shadow/cutover em ambiente real. Antes disso, usa-se fixture, fake pool, sandbox e variável placeholder.

## 7. Subtarefas e allowlists

| Tarefa | Escopo exclusivo | Não pode tocar | Saída |
|---|---|---|---|
| F6-C0 | este contrato e testes `tests/contracts/f6/` | produção, schema, Jules | desenho aprovado |
| F6-J1 | `packages/core/social-brain/db/src/drizzle/**`, `packages/core/social-brain/db/tests/drizzle-bootstrap.test.ts` | migrations, RLS, rotas, secrets | bootstrap read-only |
| F6-J2 | `apps/crm/lib/db/drizzle/domains/crm/**`, `apps/crm/tests/unit/f6-shadow-crm.test.ts` | outros domínios | shadow CRM |
| F6-J3 | `apps/crm/lib/db/drizzle/domains/messaging/**`, `apps/crm/tests/unit/f6-shadow-messaging.test.ts` | storage, SSE, schema | shadow messaging |
| F6-J4 | `apps/crm/lib/db/shadow-read/**`, `apps/crm/tests/unit/f6-shadow-read-contract.test.ts` | adapters de domínio | comparator/flags/rollback |
| F6-C1 | revisão Codex e testes de matriz | merge/cutover automático | decisão de promoção |
| F6-H1 | ação Owner por último | qualquer credencial inventada | ativação real explícita |

Todas as sessões Jules devem fazer setup remoto, rodar `git diff --name-only` antes de PR, remover auxiliares temporários, seguir RED→GREEN e reportar somente resultado limpo. Nenhum worker recebe permissão para migration, RLS, produção, credencial ou merge.

## 8. Regras obrigatórias

- `.claude/rules/database-migrations.md`
- `.claude/rules/multi-tenancy.md`
- `.claude/rules/data-modeling.md`
- `.claude/rules/security.md`
- `.claude/rules/api-contract.md`
- `.claude/rules/audit-observability.md`
- `.claude/rules/testing-verification.md`

Qualquer conflito entre este desenho e essas regras resolve-se pela regra mais restritiva e é registrado como decisão antes de implementar.
