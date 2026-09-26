# Design — Preservação integral da doutrina no harness modular

**Data:** 2026-08-10  
**Status:** aprovado em conversa; aguardando revisão do documento escrito antes da implementação  
**Branch:** `gpt-harness-convergence`  
**Base:** `main` @ `4fa4ca9a7042b88d6de35e411e4375213fb26d93`

> **Estado histórico (2026-09-26):** este design registra decisões anteriores à arquitetura operacional atual. A política vigente versiona `.claude/settings.json` compartilhado e ignora `.claude/settings.local.json`; consulte `docs/harness-doctrine-matrix.md`.

## Objetivo

Manter a arquitetura modular criada em `gpt-harness-convergence` sem perder, enfraquecer ou generalizar decisões válidas do `CLAUDE.md` original da `main`.

O resultado desejado é:

- `CLAUDE.md` continua sendo a autoridade principal;
- `.claude/rules/` continua sendo a camada modular por domínio;
- toda obrigação normativa válida do `CLAUDE.md` original continua existindo, de forma semanticamente equivalente, no conjunto `CLAUDE.md + .claude/rules/ + docs canônicos explicitamente referenciados`;
- snapshots temporais, métricas e inventários não viram doutrina permanente;
- nenhuma regra de produto/segurança é removida apenas por ser detalhada;
- o novo `harness:check` passa a proteger também a preservação de doutrina crítica.

## Princípio central

> Mudar onde uma regra mora não significa mudar a regra.

A modularização pode reduzir repetição e tamanho do arquivo principal, mas não pode alterar requisitos, SLAs, invariantes, formatos, limites ou comportamentos sem evidência de que a fonte canônica atual mudou.

## Fontes de verdade para a reconciliação

A reconciliação usa, nesta ordem:

1. `CLAUDE.md` da `main` no commit-base acima como baseline histórico a preservar;
2. `docs/specs/` para contrato técnico vigente;
3. `docs/prd/` para intenção de produto;
4. `docs/business-rules/` para regras de negócio fora do código;
5. `docs/doctrine/` para invariantes especializadas;
6. código/testes atuais apenas para confirmar se uma regra antiga continua implementada ou já divergiu de uma fonte canônica mais recente.

Quando uma regra do `CLAUDE.md` original conflitar com spec/PRD/doctrine atual, não manter as duas silenciosamente: registrar a divergência e usar a fonte de maior precedência já definida pelo repositório.

## Separação: doutrina estável vs. snapshot mutável

### Permanece como doutrina

Exemplos:

- service role filtra `organization_id` manualmente;
- backend usa `getUser()` em vez de `getSession()` como prova de identidade;
- trigger Postgres não faz HTTP;
- schema sai em migration + baseline + MANIFEST;
- API key não vai em query string;
- regras de anonimização/irreversibilidade LGPD enquanto continuarem vigentes;
- regras de MFA/RBAC enquanto continuarem vigentes;
- contratos de idempotência, audit, WAHA e modelagem enquanto continuarem vigentes.

### Sai da doutrina principal e vira snapshot/documentação de estado

Exemplos:

- quantidade de arquivos de teste;
- quantidade de route handlers;
- números de migrations;
- quantidade de E2E atualmente no CI;
- estado de um épico;
- SHA auditado;
- métricas de Graphify de uma geração específica.

Esses dados podem permanecer em `docs/current-state.md`, `docs/harness-audit.md` ou relatórios, sempre com data/SHA.

## Arquitetura alvo

```text
CLAUDE.md
│
├── autoridade e precedência
├── visão/stack estável
├── invariantes transversais
├── comandos canônicos
├── approval/safety gates
├── Definition of Done
└── índice para regras detalhadas
    │
    └── .claude/rules/
        ├── git-workflow.md
        ├── security.md
        ├── multi-tenancy.md
        ├── database-migrations.md
        ├── testing-verification.md
        ├── documentation.md
        ├── graphify.md
        ├── skill-routing.md
        ├── api-contract.md
        ├── audit-observability.md
        ├── lgpd.md
        ├── whatsapp-waha.md
        └── data-modeling.md
```

As cinco rules novas são propostas porque a primeira modularização resumiu demais exatamente esses domínios.

## Regras a restaurar explicitamente

### API e idempotência

Preservar, quando confirmado contra as fontes atuais:

- versionamento `/api/v1/`;
- JSON `snake_case` na API, sem confundir com naming de arquivos;
- wrappers `ok()` / `fail()`;
- UUID/ISO-8601/dinheiro em `_cents` + `currency`;
- autenticação cookie/bearer conforme superfície;
- API key nunca em query string;
- plaintext de bearer mostrado uma vez e armazenado por hash quando esse for o contrato;
- `Idempotency-Key` e TTL documentado quando ainda vigente;
- headers de rate limit e `Retry-After` quando aplicáveis;
- `X-Request-Id` e correlação com audit quando vigentes.

### Audit e observabilidade

Preservar, quando confirmado:

- mutações relevantes geram `api_audit_log`;
- append-only;
- comportamento de falha do audit;
- política de retenção/hot/cold quando ainda vigente;
- proibição de PII/secrets em logs;
- uso de Sentry/logger sem confiar apenas em sanitização posterior.

### LGPD

Preservar, quando confirmado:

- anonimização preferida sobre delete;
- cascade de redact;
- irreversibilidade;
- SLAs D+7/D+15 ou os valores atuais da fonte canônica;
- ações de audit LGPD;
- tratamento de mídia e histórico.

### Auth/RBAC

Preservar, quando confirmado:

- `getUser()` server-side;
- hierarquia de roles;
- super-admin/plataforma;
- MFA obrigatório nos papéis definidos;
- `user_pipeline_access` fora do MVP se ainda vigente;
- enforcement server-side.

### WhatsApp/WAHA

Preservar, quando confirmado:

- Plus/NOWEB e exceções;
- formato de auth da API key;
- HMAC timing-safe;
- throttle/jitter/warm-up/janela de envio;
- STOP/opt-out;
- fluxo de mídia;
- `message.any`/`fromMe`;
- comportamento de grupos;
- política do `recover-stuck-messages`;
- qualquer outra regra que continue normativa em PRD/spec/runbook.

### Modelagem

Preservar, quando confirmado:

- DIRC;
- tabelas core relevantes;
- fractional indexing;
- `external_id` nullable no estado descrito;
- `text + check constraint` vs enum e exceções deliberadas;
- vocabulário aberto;
- `tags`/GIN;
- `custom_fields`/schema declarativo;
- `vocabulary` por pipeline;
- anti-patterns do original.

## Estratégia de reconciliação

Para cada regra normativa do `CLAUDE.md` original:

1. classificar como `ESTÁVEL`, `SNAPSHOT` ou `DIVERGENTE`;
2. localizar a fonte canônica atual correspondente;
3. para `ESTÁVEL`, garantir representação explícita no novo harness;
4. para `SNAPSHOT`, mover/qualificar em documentação de estado;
5. para `DIVERGENTE`, não escolher por memória: registrar a diferença e seguir a fonte de maior precedência;
6. adicionar teste/gate quando a regra for crítica e deterministicamente verificável.

## Mudanças permitidas

- editar `CLAUDE.md` na branch para restaurar precisão;
- criar/editar `.claude/rules/*.md`;
- ajustar `AGENTS.md` e skills apenas para alinhamento de ponteiros/autoridade;
- ampliar `scripts/check-harness-consistency.mjs` e seus testes;
- atualizar `docs/runbooks/agent-harness.md`, spec/plano/handoff;
- ajustar `.gitignore`, `package.json` ou `ci.yml` apenas se necessário para o harness.

## Fora de escopo

Não alterar:

- `main`;
- Supabase/schema/migrations;
- código de produto em `app/`, `lib/`, `components/`, `workers/`;
- Vercel/WAHA/Redis/Docker/produção;
- credenciais/dados reais;
- branch `gpt-ai-platform`;
- comportamento de `gov-loop`, `triagem-*` ou `.codex/agents/*.toml`.

Se a auditoria descobrir que uma regra antiga já não corresponde ao código/spec atual, documentar o achado; não corrigir produto como parte desta iniciativa.

## Gate de preservação

O `harness:check` deve continuar protegendo as regressões já cobertas e ganhar verificações determinísticas para itens de alto risco, por exemplo:

- skills apontam para `CLAUDE.md`;
- rules obrigatórias existem e são versionáveis;
- `.claude/settings.json` continua local;
- referências ao repositório histórico não voltam;
- comandos inexistentes não voltam;
- regras normativas antigas de naming/import não voltam;
- domínios críticos (`lgpd`, `api-contract`, `audit-observability`, `whatsapp-waha`, `data-modeling`) não desaparecem da árvore modular;
- `CLAUDE.md` mantém links/ponteiros para todas as rules críticas.

O gate não deve tentar interpretar toda a semântica de Markdown. Para equivalência completa, usar também uma matriz documental de reconciliação.

## Matriz de preservação

Criar `docs/harness-doctrine-matrix.md` com uma linha por grupo de regra relevante:

| Regra original | Classificação | Fonte atual | Destino novo | Estado |
|---|---|---|---|---|
| Service role filtra tenant | ESTÁVEL | CLAUDE/spec | multi-tenancy.md | preservada |
| Contagem de testes | SNAPSHOT | current-state | current-state.md | fora da doutrina |
| Exemplo hipotético divergente | DIVERGENTE | spec atual | regra atual | reconciliada |

A matriz é o mecanismo de auditoria para provar que nenhuma obrigação foi simplesmente esquecida.

## Critérios de aceite

1. Nenhuma regra normativa válida do `CLAUDE.md` original fica sem destino ou justificativa registrada.
2. Toda regra removida do arquivo principal aparece em rule/doc canônico ou é classificada como snapshot/divergente.
3. LGPD, API/idempotência, audit, Auth/RBAC, WAHA e modelagem recuperam o nível de precisão necessário.
4. Nenhum snapshot temporal é promovido a doutrina permanente.
5. Claude e Codex continuam apontando para a mesma autoridade.
6. `gov-loop`, triagem e agentes Codex permanecem funcionalmente intactos.
7. `harness:check` e seus testes cobrem a estrutura crítica nova.
8. O diff final não toca código de produto, schema ou produção.
9. A branch permanece separada, sem PR/merge para `main` sem autorização explícita.
10. O relatório final distingue claramente o que foi verificado remotamente do que depende de teste local/CI.

## Testes e verificação

- TDD para qualquer mudança de comportamento do `harness:check`;
- `pnpm test:harness`;
- `pnpm harness:check`;
- inspeção `main...gpt-harness-convergence`;
- busca pelos padrões antigos já conhecidos;
- verificação da matriz de preservação contra o `CLAUDE.md` original;
- `pnpm gov:verify` apenas quando houver ambiente executável apropriado; se não for possível, declarar explicitamente.

## Decisão

A direção aprovada é: **estrutura nova + preservação semântica integral da doutrina válida original + snapshots separados + gate para impedir regressão futura**.
