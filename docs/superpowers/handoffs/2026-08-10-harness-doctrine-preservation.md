# Handoff — Preservação da doutrina no harness modular

**Branch:** `gpt-harness-convergence`  
**Baseline histórico da reconciliação:** `main@4fa4ca9a7042b88d6de35e411e4375213fb26d93`  
**Status:** implementação do escopo de preservação concluída na branch; sem PR/merge para `main`.

## Objetivo

Manter a arquitetura modular criada para Claude/Codex sem perder ou enfraquecer regras válidas do `CLAUDE.md` original.

Princípio aplicado:

> Mudar onde uma regra mora não significa mudar a regra.

## Resultado arquitetural

`CLAUDE.md` continua autoridade. A doutrina detalhada agora é dividida em 13 rules:

1. `git-workflow.md`
2. `security.md`
3. `multi-tenancy.md`
4. `api-contract.md`
5. `audit-observability.md`
6. `lgpd.md`
7. `whatsapp-waha.md`
8. `data-modeling.md`
9. `database-migrations.md`
10. `testing-verification.md`
11. `documentation.md`
12. `graphify.md`
13. `skill-routing.md`

`AGENTS.md`, as skills Claude/Codex e `.codex/AGENTS.md` apontam para a mesma autoridade em vez de manter doutrina independente.

## Doutrina restaurada/explicitada

### API e idempotência

- `/api/v1/`, JSON `snake_case` somente como contrato de API;
- UUID/ISO-8601/dinheiro em cents;
- `ok()`/`fail()` e códigos canônicos;
- cursor HMAC;
- cookie/bearer conforme superfície;
- API key nunca em query string;
- bearer plaintext mostrado uma vez e não persistido recuperável;
- `Idempotency-Key` em POST de criação com TTL 24h e 409 para key reutilizada com payload incompatível;
- headers de rate limit e `X-Request-Id` conforme contrato base.

### Audit/observabilidade

- `api_audit_log` para mutações relevantes;
- append-only;
- fire-and-forget com falha visível sem derrubar a mutação principal pelo contrato atual;
- target p99 <=500ms;
- retenção 5 anos, 90 dias hot + cold storage;
- PII/secrets fora de logs/Sentry.

### LGPD

- anonimização preferida a delete quando há histórico;
- irreversibilidade;
- cascade completo conforme specs;
- consentimento granular;
- export D+7 dias úteis;
- redact D+15 dias úteis;
- actions/audit de operações sensíveis.

### Auth/RBAC e tenancy

- `getUser()` server-side;
- roles `viewer < agent < manager < admin`;
- MFA TOTP obrigatório para admin/platform admin;
- `user_pipeline_access` continua fora do MVP segundo PRD 01;
- service role filtra tenant manualmente;
- platform admin é único papel cross-tenant do contrato base.

### WAHA

- WAHA Plus/NOWEB;
- hash SHA512 no servidor + plaintext em `X-Api-Key` no cliente;
- HMAC-SHA512 timing-safe;
- throttle/jitter/warm-up/janela/limites/spinning;
- STOP/opt-out vigente;
- `message.any`/`fromMe`;
- grupos sem binding CRM indevido;
- `recover-stuck-messages` conforme W-12/código atual: `sending` >5min, não toca `queued`, não reenvia automaticamente, emite falha e abre aviso na Central.

### Modelagem, migrations e QA

- DIRC e anti-patterns;
- cinco tabelas core CRM e fractional indexing;
- `external_id` nullable onde lifecycle exige;
- regras de check/vocabulário aberto;
- tags/GIN, custom fields, vocabulary;
- migration + baseline + MANIFEST;
- forward-fix, backfill antes de constraint e portabilidade de migrations;
- ambos os revokes necessários para funções públicas quando aplicável;
- QA com browser real, banco fresh via baseline e ambiente estilo VPS quando a aceitação exige primeira instalação;
- side effect real/receiver controlado quando mock não prova a borda de risco.

## Divergências reconciliadas, não copiadas cegamente

1. **Platform admin:** o texto histórico falava em `is_platform_admin`; a Spec 01 atual resolve a representação como tabela `platform_admins`. A rule usa a decisão atual.
2. **STOP:** a fonte atual inclui `CANCELAR`; foi usada a regra vigente, não a regex histórica mais curta.
3. **Mídia WAHA:** Storage/URL permanece o caminho canônico, mas W-08 permite exceção para mídia pequena; a nova rule registra essa nuance em vez de repetir uma proibição absoluta conflitante.
4. **Snapshots:** números de testes/handlers/migrations, SHAs e estado atual de CI/épicos não foram promovidos a doutrina permanente.

A prova documental dessa reconciliação está em `docs/harness-doctrine-matrix.md`.

## Checker

`harness:check` agora exige:

- as 13 rules;
- link de `CLAUDE.md` para cada rule;
- rules versionáveis pelo `.gitignore`;
- `.claude/settings.json` permanecendo local;
- skills apontando para `CLAUDE.md`;
- contrato portátil apontando para `CLAUDE.md` + `.claude/rules/`;
- ausência das regressões antigas de ECC/repo/comandos/naming/import;
- `docs/harness-doctrine-matrix.md` presente;
- matriz contendo pelo menos `ESTÁVEL`, `SNAPSHOT` e `DIVERGENTE`.

O checker deliberadamente não tenta interpretar equivalência semântica completa de Markdown; isso pertence à matriz/review humano.

## TDD executado para a ampliação do checker

### RED

Antes de alterar o checker, foram adicionados casos para:

- ausência de `lgpd.md`;
- ausência da matriz;
- matriz sem classificação `DIVERGENTE`.

Com o checker anterior: **3 testes falharam / 0 passaram**, exatamente porque esses requisitos ainda não existiam no código do checker.

### GREEN

Depois da implementação mínima da nova estrutura, esses 3 casos passaram.

Em seguida a suíte completa do checker foi rodada em Node e terminou com:

- **12 testes**;
- **12 passaram**;
- **0 falharam**.

Isso prova o comportamento do checker em fixture isolada. Não equivale a rodar toda a suíte do CRM.

## Escopo preservado

Esta iniciativa não altera intencionalmente:

- `app/`;
- `lib/`;
- `components/`;
- `workers/`;
- `supabase/`/schema/migrations;
- produção/Vercel/WAHA/Redis/Docker;
- credenciais/dados reais;
- `gov-loop`/triagem;
- `.codex/agents/*.toml`;
- branch `gpt-ai-platform`.

O `package.json`/CI só carregam os scripts/gate do harness criados na etapa de convergência anterior.

## Estado da relação com `main`

A branch nasceu de `main@4fa4ca9...`. Durante o trabalho, `main` recebeu commits novos. Na comparação final intermediária, a branch já aparecia divergente/atrás da `main`; isso **não foi resolvido por merge automático**, porque o objetivo desta iniciativa é preservar trabalho isolado e não incorporar mudanças de produto/tooling sem uma revisão própria.

Antes de qualquer PR/merge futuro, atualizar a branch com a `main` atual em fluxo controlado e resolver conflitos preservando os dois lados, especialmente `package.json`/`AGENTS.md` se ambos tiverem avançado.

## O que ainda depende de estação/CI real

Não foi alegado como provado nesta execução remota:

- `pnpm gov:verify` completo do CRM;
- `pnpm test:db`/Docker;
- E2E do produto;
- build completo;
- carregamento real das `.claude/rules/` por uma instalação específica do Claude Code;
- `.claude/settings.json` e hooks locais de Windows/macOS.

A validação local futura deve, no mínimo, executar:

```bash
pnpm test:harness
pnpm harness:check
pnpm gov:verify
```

e confirmar o carregamento do Claude Code na estação antes de decidir integração.

## Integração

Nenhum PR foi criado e nenhum merge para `main` foi autorizado/executado por este handoff. A branch deve permanecer separada até decisão explícita do dono.
