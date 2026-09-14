# Revisão de segurança — Wave 1 Operating Core

Data: 2026-09-13  
Método: inspeção read-only via SSH no worker, sem build, testes, merge ou efeitos live.

## Estado auditado

O nome solicitado `business-os/phase-1-operating-core` não existe como ref no worker. O checkout correspondente disponível é:

- Worktree: `/home/claude/src/worktrees/business-os-wave-1-operating-core-2026-09-11`
- Branch: `business-os/wave-1-operating-core`
- HEAD: `f678e6541897babae4b5afbfe207dcfc20e927ac`

Neste HEAD, `packages/operating-core/src/` contém 5 arquivos (não 13): `contracts.ts`, `event-log-adapter.ts`, `event-log-adapter.test.ts`, `job-engine.ts` e `job-engine.test.ts`. A revisão cobre todo o conteúdo da pasta; os demais arquivos do pacote (`README`, `package.json`, `tsconfig`) não contêm lógica de execução.

## Contracts e isolamento de tenant

**Veredito: FAIL/BLOCKED para contrato de segurança completo; isolamento básico existe, mas não há validação runtime suficiente.**

- `contracts.ts:4,7` carrega `organizationId` em `Job`/`JobEvent`, permitindo correlação explícita por tenant.
- `job-engine.ts:15-16` exige `job.organizationId === organizationId` em leitura e em operações do worker; tenant cruzado e worker alheio são rejeitados.
- `job-engine.ts:14` filtra `listEvents` por `organizationId`.
- Porém, os contratos são apenas tipos TypeScript. `enqueue` (`job-engine.ts:8`) aceita `organizationId`, `id`, `kind` e payload vazios/arbitrários; não há validação runtime de formato, autorização do caller ou pertencimento do worker a um tenant.
- `recordEvidence` (`job-engine.ts:12`) aceita `Evidence.kind/ref` sem validação de conteúdo ou vínculo a uma fonte autorizada; evidência forjada pode ser anexada por qualquer caller que possua o par job/tenant.

## Job Engine e policies

**Veredito: PASS parcial contra bypass de transição; NOT_PROVEN como boundary autorizadora.**

- `job-engine.ts:2,17` define transições explícitas (`queued → claimed → running → completed → evidence`) e rejeita estados fora da tabela.
- `:9-12` exige ownership do worker para iniciar/completar, e apenas jobs do tenant correto são recuperados.
- Não há caminho fail-open de transição: erro de estado, tenant ou ownership lança `JobEngineError`.
- O engine é `InMemoryJobEngine` (`:5-7`); não oferece lock/claim atômico, persistência ou proteção contra dois workers concorrentes. Isso deixa race e durabilidade NOT_PROVEN para produção.
- `workerId` é uma string fornecida pelo chamador (`:9-10`); não é autenticada nem cruzada com capability/policy externa. O ownership impede outro ID após claim, mas não impede claim inicial por actor não autorizado que conheça o job e o tenant.

## Event Log Adapter / MCP reachability

**Veredito: PASS parcial para tenant filtering e fail-closed de envelope; enforcement de actor/MCP NOT_PROVEN.**

- `event-log-adapter.ts:93-110` usa parâmetros SQL (`$1..$6`) e `on conflict (id) do nothing`, sem SQL injection óbvia e com deduplicação por event ID.
- `:114-129` filtra replay por `organization_id`, `entity_kind`, tipos permitidos e, opcionalmente, `jobId`; `jobId` também é parametrizado (`:123-128`).
- `:61-83` rejeita prefixo, payload não objeto, versão incompatível e divergência entre ID/tenant/job/event type da linha e envelope. JSON inválido propaga erro; não vira evento aceito.
- `:54-59` rejeita tipos de evento fora da allowlist antes de append.
- Não há autenticação de quem chama `append`/`replay`, capability check ou policy version no adapter. O banco precisa fornecer RLS/privilege boundary; ela não é demonstrada nesses arquivos.

## Fail-open e secrets

Achados:

- **Fail-open crítico não observado** em transições, replay de envelope ou filtro tenant: os caminhos inválidos retornam erro/negação.
- **Lacunas de validação runtime:** IDs/tenant/kind/evidence podem ser vazios ou arbitrários; isso é risco de integridade e deve ser endurecido antes de expor a callers não confiáveis.
- **Concorrência/durabilidade:** `InMemoryJobEngine` não prova claim atômico nem sobrevivência a restart.
- Busca textual read-only nos 5 arquivos por `sk-`, `api[_-]?key`, `secret`, `password`, `Bearer`, `console.` e `logger.` não encontrou secret hardcoded ou logging sensível.

## Testes disponíveis

`job-engine.test.ts:4-15` cobre fluxo nominal, transição inválida, worker alheio e tenant cruzado. `event-log-adapter.test.ts:15-76` cobre deduplicação, replay filtrado, identidade do envelope e versão incompatível. Os testes são provider-free e não foram executados nesta auditoria.

## Veredito consolidado

**BLOCKED para promoção como Operating Core seguro de produção.**

O núcleo tem boas proteções locais de tenant, ownership, transições e envelopes, sem segredo hardcoded e sem fail-open óbvio. Faltam, contudo, validação runtime dos contratos, autenticação/capability dos callers/MCP, RLS/privileges comprovados, claim atômico e persistência do job engine. A implementação atual é uma fundação provider-free, não uma boundary de produção completa.

SELF-CHECK: PASS — ref/worktree reais confirmados, todos os arquivos de `packages/operating-core/src/` lidos, revisão read-only e sem testes/build/alterações remotas.
