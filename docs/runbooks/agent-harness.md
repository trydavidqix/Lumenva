# Runbook — Harness de agentes

Este runbook explica como manter Claude Code, Codex e os agentes especializados do Lumenva alinhados sem duplicar ou enfraquecer doutrina.

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

`docs/harness-doctrine-matrix.md` fica ao lado dessa cadeia como **prova de reconciliação**: mostra para onde foi cada grupo de regra do `CLAUDE.md` histórico e quais pontos foram classificados como snapshot ou divergência resolvida.

### `CLAUDE.md`

Fonte soberana de doutrina do repositório. Contém visão, invariantes transversais, comandos canônicos, escopo, safety gates e Definition of Done.

### `.claude/rules/`

Regras compartilhadas por domínio:

- `git-workflow.md`
- `security.md`
- `multi-tenancy.md`
- `api-contract.md`
- `audit-observability.md`
- `lgpd.md`
- `whatsapp-waha.md`
- `data-modeling.md`
- `database-migrations.md`
- `testing-verification.md`
- `documentation.md`
- `graphify.md`
- `skill-routing.md`

Uma rule detalha a doutrina; nunca a contradiz. O objetivo da modularização é **mudar onde a regra mora sem mudar a regra**.

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

## Estável, snapshot e divergente

Ao reorganizar uma instrução antiga, classifique antes:

- `ESTÁVEL` — continua normativa e precisa aparecer explicitamente em `CLAUDE.md`, rule ou fonte canônica linkada;
- `SNAPSHOT` — contagem, SHA, estado de CI/épico, versão observada ou inventário temporal; fica em docs de estado/auditoria;
- `DIVERGENTE` — uma spec/PRD/business-rule atual resolveu o ponto de forma diferente; documente a fonte vencedora na matriz.

Exemplos já reconciliados:

- super-admin: a Spec 01 define a tabela `platform_admins`; não reintroduzir `is_platform_admin` como coluna canônica;
- STOP: a fonte atual inclui `CANCELAR`;
- mídia WAHA: Storage/URL é caminho canônico, mas W-08 registra exceção para payload pequeno; não converter isso em proibição absoluta;
- contagens de E2E/testes/handlers são snapshots, não regra permanente.

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

`test:harness` testa o próprio checker. `harness:check` inspeciona a árvore real e falha quando encontra regressões estruturais conhecidas, incluindo:

- comandos obsoletos `/fix-bug` ou `/add-module` em artefatos ativos;
- referência ativa ao repositório histórico;
- regra normativa antiga de naming de arquivos;
- regra normativa antiga de imports relativos;
- skill DeskcommCRM sem ponte para `CLAUDE.md`;
- uma das 13 rules obrigatórias ausente;
- `CLAUDE.md` sem link para uma rule obrigatória;
- `.claude/rules/` não versionável;
- tentativa de versionar `.claude/settings.json` por exceção no `.gitignore`;
- matriz de preservação ausente ou sem as classificações estruturais mínimas.

O checker **não tenta provar equivalência semântica de Markdown**. Essa prova humana/auditável é a `docs/harness-doctrine-matrix.md` + revisão contra a fonte atual.

O job `verify` do CI executa `pnpm test:harness && pnpm harness:check` quando o workflow é acionado.

## Alterando doutrina

Quando uma regra realmente muda:

1. identifique a fonte de maior precedência (`CLAUDE.md`/Spec/PRD/business-rule/doctrine);
2. se estiver mudando uma regra histórica, atualize `docs/harness-doctrine-matrix.md` com a reconciliação;
3. atualize `CLAUDE.md` quando a mudança for transversal;
4. atualize a rule do domínio;
5. atualize `AGENTS.md` apenas se o núcleo portátil mudou;
6. atualize skills/adapters somente se seus ponteiros/resumos ficaram incorretos;
7. rode `pnpm test:harness && pnpm harness:check`;
8. rode os demais testes conforme o raio de dano;
9. revise o diff para garantir que nenhuma cópia congelada nova foi criada.

## Não fazer

- não copie o `CLAUDE.md` inteiro para cada skill;
- não apague regra detalhada apenas para deixar o arquivo principal menor;
- não gere convenções permanentes a partir de poucos commits e trate como autoridade;
- não restaure literalmente uma regra histórica se a spec atual resolveu a decisão de outra forma;
- não crie reviewer novo quando `gov-verifier`/Codex reviewer já cobrem o fluxo;
- não misture configuração local de máquina com doutrina versionada;
- não edite `gov-loop`/triagem apenas para “acompanhar” uma reorganização documental sem necessidade funcional;
- não use documentos `current-state`/handoff antigos como regra eterna.

## Validação local final

Depois de uma mudança estrutural do harness, uma estação com Claude Code deve confirmar o carregamento real das instruções/rules usando os mecanismos atuais da ferramenta. Essa prova local complementa o gate de arquivos; o CI não consegue provar como uma instalação específica do Claude Code resolveu configuração local e hooks.
