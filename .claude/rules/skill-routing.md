# Skill Routing — Lumenva

> Regra operacional geral do repositório Lumenva.

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

## Autoridade por assunto

Segurança e preservação, mais instrução válida do Owner, governam ações. Para comportamento do produto valem as fontes canônicas do domínio (`docs/specs/`, business rules e PRDs indexados em `docs/index.md`). `CLAUDE.md` define processo e orquestração; rules definem políticas técnicas/operacionais; skills descrevem workflows; agents definem especialidades. Se fontes da mesma camada divergirem, registre e resolva a fonte obsoleta no assunto específico; não declare uma ordem universal entre produto e processo.
