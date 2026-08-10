# Runbook — Harness de agentes

Este runbook explica como manter Claude Code, Codex e os agentes especializados do DeskcommCRM alinhados sem duplicar doutrina.

## Hierarquia de autoridade

```text
CLAUDE.md
   ↓
.claude/rules/
   ↓
AGENTS.md
   ↓
skills/adapters de plataforma
   ↓
agents especializados
   ↓
gates determinísticos
```

### `CLAUDE.md`

Fonte soberana de doutrina do repositório. Contém visão, invariantes transversais, comandos canônicos, escopo, safety gates e Definition of Done.

### `.claude/rules/`

Regras compartilhadas por domínio:

- `git-workflow.md`
- `security.md`
- `multi-tenancy.md`
- `database-migrations.md`
- `testing-verification.md`
- `documentation.md`
- `graphify.md`
- `skill-routing.md`

Uma rule detalha a doutrina; nunca a contradiz.

### `AGENTS.md`

Contrato portátil para ferramentas que não consomem diretamente a configuração do Claude Code. Deve permanecer curto e apontar para `CLAUDE.md`/rules.

### Skills DeskcommCRM

Existem duas superfícies:

- `.claude/skills/DeskcommCRM/SKILL.md`
- `.agents/skills/DeskcommCRM/SKILL.md`

As duas são pontes para a mesma doutrina. Não devem congelar naming convention, estilo de imports, comandos, contagens ou estado temporal do repo.

### Agents especializados

- `.claude/agents/gov-implementer.md`
- `.claude/agents/gov-verifier.md`
- `.claude/agents/triagem-*.md`
- `.codex/agents/*.toml`

Esses arquivos definem **papel/processo**, não doutrina alternativa.

## Configuração local

`.claude/settings.json` é local da estação. O repositório não o versiona.

O `loop/setup-claude-guard.mjs` instala/mescla o guard necessário no arquivo local quando o gov-loop precisa dele. Não transforme `settings.json` em fonte de configuração compartilhada sem uma decisão explícita de arquitetura.

Credenciais/MCPs privados do Codex também ficam no armazenamento/configuração local apropriado, não no Git.

## Gate de consistência

Rode:

```bash
pnpm test:harness
pnpm harness:check
```

`test:harness` testa o próprio checker. `harness:check` inspeciona a árvore real e falha quando encontra regressões conhecidas, incluindo:

- comandos obsoletos `/fix-bug` ou `/add-module` em artefatos ativos;
- referência ativa ao repositório histórico;
- regra normativa antiga de naming de arquivos;
- regra normativa antiga de imports relativos;
- skill DeskcommCRM sem ponte para `CLAUDE.md`;
- `.claude/rules/` ausente/não versionável;
- tentativa de versionar `.claude/settings.json` por exceção no `.gitignore`.

O job `verify` do CI executa os dois comandos.

## Alterando doutrina

Quando uma regra realmente muda:

1. altere primeiro `CLAUDE.md` ou a spec/doc canônico correspondente;
2. atualize a rule do domínio quando necessário;
3. atualize `AGENTS.md` apenas se o núcleo portátil mudou;
4. atualize skills/adapters somente se seus ponteiros/resumos ficaram incorretos;
5. rode `pnpm test:harness && pnpm harness:check`;
6. rode os demais testes conforme o raio de dano;
7. revise o diff para garantir que nenhuma cópia congelada nova foi criada.

## Não fazer

- não copie o `CLAUDE.md` inteiro para cada skill;
- não gere convenções permanentes a partir de poucos commits e trate como autoridade;
- não crie reviewer novo quando `gov-verifier`/Codex reviewer já cobrem o fluxo;
- não misture configuração local de máquina com doutrina versionada;
- não edite `gov-loop`/triagem apenas para “acompanhar” uma reorganização documental sem necessidade funcional;
- não use documentos `current-state`/handoff antigos como regra eterna.

## Validação local final

Depois de uma mudança estrutural do harness, uma estação com Claude Code deve confirmar o carregamento real das instruções/rules usando os mecanismos atuais da ferramenta (por exemplo, diagnóstico/memória disponíveis na versão instalada). Essa prova local complementa o gate de arquivos; o CI não consegue provar como uma instalação específica do Claude Code resolveu configuração local e hooks.
