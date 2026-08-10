# Documentation — DeskcommCRM

> Regra modular compartilhada. Em caso de conflito, `CLAUDE.md` da raiz vence.

## Precedência

Quando documentos discordam, use a hierarquia documentada no repositório:

1. `CLAUDE.md` — doutrina;
2. `docs/specs/` — contrato técnico;
3. `docs/prd/` — intenção de produto;
4. handoffs/estado de sessão;
5. READMEs e material explicativo.

Corrija a fonte de menor precedência em vez de inventar uma terceira versão da regra.

## Quando atualizar documentação

Atualize documentação quando uma mudança altera:

- comportamento observável;
- arquitetura;
- configuração;
- variáveis de ambiente;
- schema/contrato;
- APIs;
- integração externa;
- instalação/self-host;
- operação/deploy;
- regras dos agentes/harness.

Alterações puramente ortográficas, de espaçamento ou refatoração sem mudança de contrato normalmente não exigem nova documentação.

## Estado versus doutrina

Documentos como `docs/current-state.md`, handoffs, contagens e snapshots têm validade temporal. Não trate números antigos ou `audited_against` antigo como verdade atual sem revalidar.

Doutrina duradoura deve viver em `CLAUDE.md`, `.claude/rules/`, specs ou docs de arquitetura apropriados; não em handoff histórico.

## Antes de criar documento novo

1. consulte `docs/index.md`;
2. procure fonte canônica existente;
3. prefira atualizar a fonte correta a criar documento duplicado;
4. não use `CLAUDE.md` como changelog ou registro de tarefas.

## Harness

Mudança em `CLAUDE.md`, `AGENTS.md`, `.claude/rules/`, `.claude/skills/`, `.agents/skills/`, `.codex/` ou gates do harness deve manter a hierarquia de autoridade explícita e passar `pnpm harness:check` quando esse comando estiver disponível.
