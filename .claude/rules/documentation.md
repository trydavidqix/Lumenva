---
paths:
  - "**/*.md"
---

# Documentação do repositório

> Regra operacional resumida. O contrato do produto pertence à fonte canônica do domínio em `docs/index.md`.

## Autoridade por assunto

Contrato e comportamento do produto pertencem à fonte canônica do domínio (`docs/specs/`, `docs/business-rules/`, PRDs e documentos indexados). `CLAUDE.md` descreve como o agente trabalha; rules documentam políticas operacionais. Handoffs, estados e READMEs são informativos e temporais. Quando fontes do mesmo assunto discordarem, verifique versão/escopo, corrija a fonte obsoleta e evite manter cópias divergentes.

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
