---
paths:
  - "apps/crm/lib/database.types.ts"
  - "infra/supabase/**"
---

# Modelagem de dados do CRM

> Regra operacional resumida. O contrato do produto pertence à fonte canônica do domínio em `docs/index.md`. Schema exato pertence às specs/migrations atuais.

## DIRC antes de adicionar campo

Antes de criar coluna/estado novo, responda:

- **D — Duplicar:** o dado vive realmente aqui ou será uma segunda fonte de verdade?
- **I — Integrar:** deveria vir de outra tabela via FK/relação?
- **R — Referenciar:** basta armazenar um ponteiro para a fonte canônica?
- **C — Calcular:** pode ser derivado on-demand sem persistir estado duplicado?

Campo novo sem essa decisão explícita tende a virar sincronização e dívida.

## Núcleo CRM

A Spec 02 define como núcleo gravitacional as tabelas:

- `crm_pipelines`;
- `crm_stages`;
- `crm_leads`;
- `crm_lead_activities`;
- `crm_lead_links`.

`contacts` é a fonte canônica de identidade de pessoa no tenant. Não crie um segundo modelo paralelo de lead/contact quando a relação existente resolve.

## Ordenação de cards

`position_in_stage` usa **numeric/fractional indexing**, não contador inteiro de posição.

Movimento entre vizinhos usa midpoint; compactação/rebalance é operação específica quando precisão se degrada. Veja business rule P-05/Spec 02.

## IDs externos

`external_id` pode ser nullable onde o lifecycle exige — exemplo canônico: mensagem outbound nasce `sending` antes de o WAHA devolver ID externo. Não force NOT NULL sem corrigir o fluxo produtor.

Quando existe ID externo de provedor, uniqueness/idempotência precisa incluir o tenant conforme o domínio.

## Vocabulários e constraints

Por default, domínios fechados podem usar `text` + `check constraint` em vez de enum Postgres quando extensibilidade operacional importa.

**Exceção deliberada: vocabulário aberto/legado.** Se clones existentes podem conter valores históricos válidos fora de uma lista fechada, adicionar CHECK retroativo pode quebrar `update.sh`. Nesses casos:

- corrija/backfill antes de constraint quando a intenção for fechar o vocabulário; ou
- mantenha a coluna aberta quando a doutrina/spec disser que o vocabulário é extensível;
- emissor TypeScript usa constante compartilhada quando houver vocabulário canônico;
- não “complete” o schema adicionando CHECK só porque existe uma union TypeScript.

Consulte `tests/invariants/vocabulario-banco-x-typescript.test.ts` antes de mudar essa fronteira.

## Tags

Tags de contato/lead seguem o contrato `text[]` + GIN quando definido pela spec. Só promova campo/tag para coluna gerada/index dedicado quando virar hot path medido; não faça denormalização preventiva.

## `custom_fields`

`custom_fields jsonb` precisa de **schema declarativo central** (por exemplo em settings do pipeline) e validação coerente. UI não deve inventar paths JSONB sem contrato compartilhado.

A Spec 02 privilegia GIN `jsonb_path_ops` por default e promoção data-driven de campos muito consultados.

## Vocabulary do pipeline

`vocabulary jsonb` permite adaptar rótulos (`lead`, `deal`, `won`, `lost` etc.) por pipeline/tenant. A UI usa o vocabulary canônico; não transforme rótulo default em dado persistido duplicado.

Business rule P-07: vocabulary rege **rótulos da UI**, não a semântica dos dados.

## Timeline e polimorfismo

Entidades polimórficas (`crm_lead_activities`, `crm_lead_links` etc.) precisam de vocabulário padronizado. Não crie `target_kind`/`type` incompatível em cada feature.

## Anti-patterns proibidos

- string que deveria ser FK (`owner_email` em vez de `owner_user_id`, por exemplo);
- duplicação sem source of truth declarado;
- evento sem consumer;
- FK ausente substituída por inferência de nome/slug;
- campo sincronizado por cron quando deveria haver relation/evento/realtime apropriado;
- `jsonb` lock-in com UI lendo path sem schema central;
- cascade que destrói histórico que o produto precisa preservar;
- polimorfismo sem vocabulário consistente;
- trigger Postgres fazendo HTTP;
- service role em request handler sem filtro manual de `organization_id`;
- `getSession()` como prova de identidade backend;
- API key em query string;
- bearer plaintext persistido;
- `console.log` deixado em código merged.

## Schema e self-host

Toda mudança de modelagem persistida segue `.claude/rules/database-migrations.md`: migration + baseline idempotente + MANIFEST, com backfill antes de constraint quando necessário.

## Fontes

- `docs/specs/02-spec-customer-360.md`
- `docs/specs/03-spec-whatsapp-waha.md`
- `docs/business-rules/00-business-rules-catalog.md` P-01…P-08
- `docs/doctrine/` e invariantes de banco para exceções posteriores
