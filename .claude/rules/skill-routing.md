# Skill Routing — DeskcommCRM

> Regra modular compartilhada. Em caso de conflito, `CLAUDE.md` da raiz vence.

## Princípio

Skills, agents e packs são mecanismos de processo ou especialização. Eles não substituem a doutrina do repositório e não podem criar uma regra conflitante com `CLAUDE.md`.

## Antes de usar uma skill

1. identifique se existe skill aplicável;
2. leia a versão atualmente instalada/visível;
3. siga primeiro a skill de processo relevante;
4. use skills técnicas/de domínio como complemento;
5. não diga que usou uma skill se ela não foi realmente carregada e seguida.

## Mapeamento de processo

- nova funcionalidade/alteração de comportamento → brainstorming antes de implementar;
- design aprovado com múltiplas etapas → writing-plans;
- bug/comportamento inesperado → systematic-debugging;
- implementação/bugfix → test-driven-development quando aplicável;
- antes de declarar conclusão → verification-before-completion.

## Evitar duplicação

- Não execute simultaneamente múltiplos workflows completos que fazem o mesmo papel.
- Um revisor especializado não precisa reimplementar o fluxo do orquestrador.
- O `gov-loop` já separa maker/checker; não crie outro reviewer no mesmo caminho sem necessidade demonstrada.
- `.codex/agents/` contém especialistas do Codex; `.claude/agents/` contém especialistas do Claude Code. Compartilhe doutrina por arquivos canônicos, não copiando prompts inteiros entre plataformas.

## Skill do repositório

As skills `DeskcommCRM` para Claude/Codex devem funcionar como ponte para:

- `CLAUDE.md`;
- `AGENTS.md` quando necessário;
- `.claude/rules/` pertinentes;
- specs/docs canônicos do domínio.

Elas não devem congelar convenções voláteis de naming, imports, comandos ou contagens do repositório.

## Prioridade

Em conflito de instruções do harness:

1. segurança/preservação de dados e instrução explícita do usuário;
2. `CLAUDE.md`;
3. specs/docs canônicos do domínio;
4. `.claude/rules/`;
5. `AGENTS.md` e adapters de plataforma;
6. skill/agent específico;
7. comportamento default da ferramenta.
