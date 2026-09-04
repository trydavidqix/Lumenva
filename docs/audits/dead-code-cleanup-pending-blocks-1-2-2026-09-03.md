# Pendência Blocos 1-2 Dead Code — investigação do `pnpm test:unit`

Data: 2026-09-03

## Resultado confirmado

O `pnpm test:unit` não está parado num teste específico nem falhando por uma
chamada de rede. A reprodução local com `--reporter verbose` e um encerramento
externo após 45 segundos terminou com exit code `130` (`SIGINT`), mas mostrou
testes passando continuamente até o ponto do sinal. O último teste visível foi
`tests/unit/nav-hub.test.tsx > NavHub > agrupa os cards sob a própria seção, não numa lista solta`.

Os testes isolados abaixo terminaram com exit code `0`:

- `tests/unit/nav-hub.test.tsx` — 6 testes;
- `tests/unit/navegacao-completude.test.ts` — 6 testes;
- `tests/unit/navegacao-registry.test.ts` — 19 testes;
- `tests/unit/next-action-routing.test.ts` — 10 testes;
- `tests/unit/next-config-output.test.ts`, `notes-schema.test.ts`,
  `obsidian-export.test.ts` e `onboarding-agente-nao-publicado.test.ts` — 28 testes.

Uma execução em lote da primeira metade de `tests/unit` também continuou
emitindo progresso por vários minutos, incluindo os testes que usam servidores
HTTP locais e os testes de PDF. Não houve ausência de progresso compatível com
deadlock antes da observação ser encerrada.

`pnpm exec vitest list --reporter verbose` ficou executando indefinidamente e
foi encerrado separadamente. Isso é comportamento anômalo do comando de listagem
ou do invólucro, mas não prova que a suíte de testes esteja travada.

## Hipóteses verificadas

- **Handle aberto em `nav-hub` ou nos testes isolados:** não confirmado; cada
  arquivo isolado encerrou normalmente.
- **Chamada de rede real sem mock:** não confirmada nos arquivos isolados; os
  servidores HTTP encontrados nos testes fecham-se nos próprios casos.
- **Conflito de porta/lockfile:** não observado; os testes isolados e o lote
  executaram com portas efêmeras e sem erro de bind.
- **Suíte travada por si só:** não confirmado; os pontos observados continuaram
  avançando. O `SIGINT` veio do killer externo de 45 segundos, não do Vitest.

## Causa raiz operacional

O exit `130` observado é causado pelo encerramento externo por limite de tempo
curto, enquanto a suíte monothread continua executando. A duração total da
suíte excede 45 segundos; a evidência disponível não identifica um arquivo
culpado ou handle persistente. O comportamento do ambiente VPS/Codex Cloud
continua não reproduzido como um deadlock interno.

## Recomendação de correção (não aplicada)

Não remover os blocos 1/2 com base no `SIGINT`. Primeiro ajustar o mecanismo de
execução/observação para permitir a duração real da suíte (ou executar lotes
determinísticos com timeout proporcional) e registrar o resumo final do Vitest.
Se uma execução com tempo suficiente ainda não terminar, repetir a bisseção por
arquivo usando o reporter `hanging-process` e inspeção de handles no processo
que permanecer vivo. Só após um exit normal verificável reabrir as remoções de
`skills-legacy.ts` e das dependências.

## Estado

Blocos 1 e 2 permanecem pendentes. Nenhum fix de teste, configuração ou código
foi aplicado nesta investigação.

## Execução autorizada na VPS

Em 2026-09-03, os containers de produção foram parados temporariamente com:

```text
docker compose -f docker-compose.prod.yml down
```

no checkout `/root/deskcommcrm` da VPS `lumenva-crm`. A suíte completa foi
executada sem timeout externo:

```text
pnpm test:unit --reporter verbose
```

Log completo: `/tmp/deskcomm-test-unit-20260903-222135.log` na VPS.

Resultado real:

- duração do Vitest: `683.96s` (11m23.96s);
- duração total medida incluindo parada/restart: `698s` (11m38s);
- arquivos de teste: `475 passed`, `72 failed` de `547`;
- testes: `3990 passed`, `40 failed`, `4 skipped` de `4034`.

Os 72 arquivos falharam por uma causa comum de ambiente, não por travamento:
`lib/env.ts` abortou ao validar o ambiente da VPS. Os campos inválidos
confirmados no log foram `NEXT_PUBLIC_SUPABASE_URL` (`Invalid URL`),
`INTERNAL_AGENT_RUN_STUB`, `NUVEMSHOP_ENABLED` (ambos `expected one of
"true"|"false"`), `NEXT_PUBLIC_APP_URL` (`Invalid URL`) e
`NEXT_PUBLIC_ADMIN_URL` (`Invalid URL`). Os 40 testes falhos são efeitos
secundários dessa falha de import/configuração; não há evidência de handle
aberto, chamada de rede pendente ou deadlock.

Após o teste, o primeiro `docker compose ... up -d` do trap falhou porque tentou
puxar `deskcomm-app:local`. O compose foi religado imediatamente com o contrato
correto do runbook:

```text
APP_IMAGE=deskcomm-app:local APP_PULL_POLICY=never docker compose -f docker-compose.prod.yml --env-file .env up -d
```

Verificação pós-restart confirmada:

- `https://crm.lumenva.pt/` respondeu `307`;
- `deskcommcrm-app-1`: `Up (healthy)`;
- `deskcommcrm-worker-1`: `Up (healthy)`;
- `deskcommcrm-redis-1`: `Up (healthy)`;
- Caddy, WAHA, SRH e scheduler: `Up`.

Produção voltou saudável. Nenhum fix de código foi aplicado. Os blocos 1 e 2
continuam pendentes até a suíte ser executada em ambiente de teste válido, sem
os valores inválidos de produção, e os resultados serem reavaliados.

## Execução com ambiente de teste válido (2026-09-04)

Foi verificado que não há `.env.test` pronto no repositório. O `.env.example`
não é suficiente porque deixa `NEXT_PUBLIC_SUPABASE_URL` vazio; o
`.env.hostgator.example` é um template de instalação e não foi usado como
ambiente de produção. O `.env.local` existente, que contém configuração local
real, foi preservado fora do caminho de carregamento durante o teste.

Foi criado temporariamente um `.env.local` contendo somente dummies não
secretos válidos para o schema de `lib/env.ts`:
`NEXT_PUBLIC_SUPABASE_URL=https://test-placeholder.invalid`, chaves Supabase
dummy não vazias, `INTERNAL_AGENT_RUN_STUB=false`, `NUVEMSHOP_ENABLED=false`,
`NEXT_PUBLIC_APP_URL=http://localhost:3000` e
`NEXT_PUBLIC_ADMIN_URL=http://localhost:3000`. Ao terminar, o arquivo temporário
foi removido e o `.env.local` original foi restaurado. Nenhuma credencial real
foi usada na execução.

Comando executado sem timeout externo:

```text
pnpm test:unit --reporter verbose
```

Log completo: `/tmp/deskcomm-test-unit-valid-env-20260903-234433.log`.

Resultado real, exit `0`:

- arquivos de teste: `547 passed` de `547`;
- testes: `4630 passed`, `4 skipped`, `0 failed` de `4634`;
- duração do Vitest: `2564.87s` (42m44.87s), iniciando às `23:44:38`;
- não houve falha de teste; apenas os avisos esperados de ausência de chaves
  opcionais de IA/OpenAI e de segredo de impersonação.

Conclusão: o ambiente válido elimina o ruído de validação que causou as falhas
na VPS. Os blocos 1/2 (`skills-legacy.ts` e as quatro dependências candidatas)
podem seguir para a limpeza autorizada, ainda exigindo os gates próprios após
cada remoção. Nenhum fix de código foi aplicado nesta execução.

## Execução autorizada dos blocos 1/2 (2026-09-04)

Branch: `chore/dead-code-cleanup-2026-09-03-v2`. Os commits abaixo são
isolados; nenhuma alteração foi enviada ao remoto.

### Bloco 1 — `skills-legacy.ts`

Nova busca nas áreas autorizadas (`app/`, `lib/`, `components/`, `workers/`,
`tests/`, `scripts/`) não encontrou import ou referência ao caminho
`skills-legacy`. A única ocorrência de texto com `-legacy` foi o identificador
de dado de teste `proposal-legacy`, sem relação com o módulo. O arquivo também
foi confirmado byte-a-byte idêntico a `skills.ts` e o histórico não mostrou
consumidor ativo.

Remoção aplicada e commit isolado:

```text
1c5b964f chore: remove duplicate legacy skills module
```

Gates após a remoção:

- `pnpm typecheck`: exit `0`;
- `pnpm lint`: exit `0` (290 warnings preexistentes, 0 errors);
- `pnpm harness:check`: exit `0`;
- `pnpm test:unit --reporter verbose`: exit `0`, log
  `/tmp/dead-code-block1-test-unit-20260904-003929.log`;
- resultado: `547 passed` arquivos, `4630 passed`, `4 skipped`, `0 failed`;
- duração do Vitest: `3370.19s` (56m10.19s).

Estado: **feito e verde**.

### Bloco 2 — dependências candidatas

Foi feita busca textual e `pnpm why` individual/consolidado antes da alteração.

- `@tanstack/react-virtual`: não há import direto, require dinâmico ou uso de
  runtime; as ocorrências restantes são somente documentação. Removido de
  `package.json` e `pnpm-lock.yaml`, seguido de `pnpm install`.
- `@langchain/core`: **não removido**. É peer dependency exigida por
  `@langchain/langgraph`, `@langchain/langgraph-checkpoint` e
  `@langchain/langgraph-checkpoint-postgres`.
- `import-in-the-middle`: **não removido**. É dependência transitiva de
  `@opentelemetry/instrumentation`, carregada pela instrumentação do Sentry.
- `require-in-the-middle`: **não removido**. É dependência transitiva de
  `@opentelemetry/instrumentation`, também necessária ao caminho do Sentry.

Commit isolado da remoção confirmada:

```text
a69cbee4 chore: remove unused react virtual dependency
```

Gates após `pnpm install` e a remoção de `@tanstack/react-virtual`:

- `pnpm typecheck`: exit `0`;
- `pnpm lint`: exit `0` (290 warnings preexistentes, 0 errors);
- `pnpm harness:check`: exit `0`;
- `pnpm test:unit --reporter verbose`: exit `0`, log
  `/tmp/dead-code-block2-test-unit-20260904-014009.log`;
- resultado: `547 passed` arquivos, `4630 passed`, `4 skipped`, `0 failed`;
- duração do Vitest: `2257.61s` (37m37.61s).

Estado: **feito e verde para `@tanstack/react-virtual`; três dependências
preservadas por necessidade transitiva/peer confirmada**. Nenhum fix de código
foi aplicado além das duas remoções autorizadas.
