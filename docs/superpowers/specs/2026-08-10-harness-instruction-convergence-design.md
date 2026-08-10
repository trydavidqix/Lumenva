# Harness Instruction Convergence — Design

**Data:** 2026-08-10  
**Status:** aprovado para implementação na branch `gpt-harness-convergence`  
**Escopo:** reorganizar instruções de agentes sem alterar comportamento de produto, banco, produção ou infraestrutura externa.

## Objetivo

Convergir Claude Code, Codex e demais agentes para uma única doutrina do DeskcommCRM, eliminar artefatos antigos contraditórios e modularizar regras de alta densidade sem enfraquecer o `gov-loop`, a triagem especializada ou os gates existentes.

## Princípios

1. `CLAUDE.md` continua sendo a autoridade de doutrina do repositório.
2. `AGENTS.md` continua sendo o contrato portátil para agentes que não consomem diretamente a configuração do Claude Code.
3. `.claude/rules/` passa a conter regras compartilhadas por domínio, versionadas no Git.
4. `.claude/settings.json` continua local e não versionado.
5. Skills e agents não definem doutrina própria; apontam para `CLAUDE.md` e carregam apenas o mínimo necessário ao seu papel.
6. `gov-implementer`, `gov-verifier`, `triagem-*`, `loop/` e `.codex/agents/` são preservados.
7. Nenhuma alteração desta iniciativa toca Supabase, Vercel, WAHA, Redis, Docker, dados reais ou segredos.
8. Nenhum merge para `main` faz parte desta iniciativa.

## Problemas confirmados

### 1. Skill do Codex contraditória

`.agents/skills/DeskcommCRM/SKILL.md` ainda ensina `snake_case`, imports relativos, `/fix-bug` e `/add-module`. A skill Claude equivalente já declara essas regras como obsoletas e manda ler `CLAUDE.md`.

### 2. Instincts herdados contraditórios

`.claude/homunculus/instincts/inherited/DeskcommCRM-instincts.yaml` foi gerado a partir de um snapshot antigo e repete `snake_case` e imports relativos.

### 3. Metadata ECC congelada

`.claude/ecc-tools.json` ainda aponta para o repositório histórico e declara como gerenciados artefatos que hoje divergem entre si.

### 4. `CLAUDE.md` concentra responsabilidades demais

O arquivo mistura doutrina transversal com detalhes de Git, segurança, tenancy, migrations, QA, documentação, Graphify, deploy e skills.

### 5. `.claude/rules/` não é versionado hoje

O `.gitignore` atual permite principalmente `agents/` e `commands/`; rules novas seriam ignoradas sem uma exceção explícita.

### 6. Ausência de gate de consistência do harness

Nada impede que uma skill ou artefato gerado volte a introduzir instruções proibidas depois de uma atualização.

## Arquitetura alvo

```text
CRM/
├── CLAUDE.md
│   └── autoridade principal e regras transversais
├── AGENTS.md
│   └── contrato portátil
├── .claude/
│   ├── rules/
│   │   ├── git-workflow.md
│   │   ├── security.md
│   │   ├── multi-tenancy.md
│   │   ├── database-migrations.md
│   │   ├── testing-verification.md
│   │   ├── documentation.md
│   │   ├── graphify.md
│   │   └── skill-routing.md
│   ├── skills/DeskcommCRM/SKILL.md
│   ├── agents/...
│   └── commands/...
├── .agents/skills/DeskcommCRM/
│   └── skill alinhada à mesma doutrina
├── .codex/
│   └── configuração específica do Codex
├── loop/
│   └── preservado
└── scripts/check-harness-consistency.mjs
```

## Conteúdo que permanece no `CLAUDE.md`

- autoridade e precedência;
- visão e stack canônica;
- lista curta de invariantes não negociáveis;
- fontes de verdade e paths críticos;
- comandos canônicos em `pnpm`;
- approval/safety gates;
- Definition of Done;
- ponteiros explícitos para `.claude/rules/`.

## Conteúdo que vai para rules

### `git-workflow.md`
Branches, working tree, atualização a partir da `main`, ações destrutivas e preservação de trabalho alheio.

### `security.md`
Segredos, auth, tokens, HMAC, service role, PII, produção e ações que exigem autorização.

### `multi-tenancy.md`
`organization_id`, RLS, `fn_user_org_ids()`, filtros manuais com service role, `getUser()` e testes cross-tenant.

### `database-migrations.md`
Tripla migration + baseline + MANIFEST, tipos regenerados, idempotência, funções públicas e revokes.

### `testing-verification.md`
Typecheck, lint, unit, DB/RLS, E2E, QA visual, evidência e diferença entre alegação e prova.

### `documentation.md`
Precedência documental, atualização quando contratos mudam e docs de estado que não devem ser tratados como eternamente atuais.

### `graphify.md`
Uso do grafo local quando presente, regeneração e limite de confiança em snapshots antigos.

### `skill-routing.md`
Papel de skills/agentes, leitura da versão instalada, processo antes de domínio e proibição de duplicar fluxos completos.

## Skills e artefatos gerados

### Claude skill
Mantida curta. Continua apontando para `CLAUDE.md` e para rules quando apropriado.

### Codex skill
Substituída por uma versão equivalente em intenção à skill Claude. Não deve carregar convenções congeladas de naming/imports nem comandos inexistentes.

### Homunculus instincts
Não continuará carregando convenções históricas como se fossem doutrina atual. Será convertido em um arquivo seguro de ponteiro/compatibilidade ou removido do conjunto gerenciado se isso puder ser feito sem quebrar o harness.

### `ecc-tools.json`
Será atualizado apenas para refletir a realidade do repositório atual e deixar claro que a doutrina não nasce de artefatos gerados. Não será tratado como fonte de verdade.

## Gate de consistência

Criar `scripts/check-harness-consistency.mjs` com execução determinística e sem dependências externas.

O gate deve falhar quando encontrar, nos artefatos de instrução relevantes:

- referência ao repositório histórico `melgarafael/DeskcommCRM` em arquivos ativos de harness;
- comandos inexistentes `/fix-bug` ou `/add-module`;
- orientação normativa para usar `snake_case` em nomes de arquivo;
- orientação normativa para usar imports relativos como padrão do projeto;
- skill Claude/Codex que não aponta para `CLAUDE.md` como fonte principal;
- `.claude/rules/` ausente ou não versionável pela política do `.gitignore`.

O gate será exposto como `pnpm harness:check` e executado no job `verify` do CI.

## Não objetivos

- substituir o gov-loop;
- criar outro code reviewer genérico;
- versionar `.claude/settings.json`;
- instalar plugins, MCPs ou software;
- alterar infraestrutura ou produção;
- alterar arquitetura de IA da branch `gpt-ai-platform`;
- reescrever todos os docs do repositório.

## Critérios de aceite

1. Claude e Codex apontam para a mesma doutrina central.
2. Nenhum artefato ativo do harness ensina as convenções antigas confirmadas como erradas.
3. `.claude/rules/` existe, é versionado e tem responsabilidades claramente separadas.
4. `CLAUDE.md` fica mais focado, sem perder invariantes críticas.
5. `.claude/settings.json` permanece local/ignorado.
6. `gov-loop`, triagem e agentes Codex existentes permanecem intactos em comportamento.
7. Existe um gate automático que detecta regressão das divergências conhecidas.
8. CI passa a executar esse gate.
9. A branch final não contém mudanças de produto, schema, produção ou segredos.
10. Nenhum merge para `main` é realizado.

## Validação disponível nesta sessão

Como a execução está sendo feita pelo conector GitHub, é possível validar estrutura, conteúdo, diff e CI configurado. Execução local do Claude Code (`/memory`, `/doctor`, carregamento real de rules/hooks) continua sendo uma prova final de estação e fica explicitamente fora deste escopo remoto.
