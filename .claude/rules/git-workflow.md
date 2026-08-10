# Git Workflow — DeskcommCRM

> Regra modular compartilhada. Em caso de conflito, `CLAUDE.md` da raiz vence.

## Antes de qualquer alteração

1. Rode `git status --short --branch`.
2. Rode `git worktree list` quando houver múltiplas sessões/worktrees.
3. Confirme a branch e preserve qualquer alteração local desconhecida.
4. Não troque de branch se isso puder perder ou misturar trabalho existente.
5. Atualize a branch de trabalho a partir da `main` somente com árvore limpa.

## Relação com `main`

- `main` é produção e fonte de integração.
- Não trabalhe diretamente em `main`.
- Uma branch de trabalho deve partir da `main` atual ou incorporar `origin/main` antes de novo trabalho.
- Branch sem commits próprios pode usar fast-forward.
- Branch divergente e limpa pode receber merge de `origin/main`.
- Conflito exige análise; nunca escolha um lado automaticamente.

## Preservação de trabalho

Nunca execute por iniciativa própria:

- `git reset --hard`;
- `git clean`;
- force-push;
- descarte/overwrite de mudanças locais;
- rebase destrutivo;
- checkout forçado;
- remoção de worktree com alterações.

Se o working tree estiver sujo e o trabalho não for claramente da sessão atual, pare a alteração daquele checkout e reporte o estado.

## Commits

- Um commit deve conter apenas o escopo da tarefa.
- Prefira `git add <paths-explicitos>` em vez de `git add -A`/`git add .` quando houver risco de misturar artefatos.
- Nunca commite segredo, `.env`, credencial ou dump com dado real.
- Mensagens seguem o padrão já usado no repositório; não derive convenção de snapshots antigos de ECC.

## Merge e publicação

- Não faça merge em `main` sem autorização explícita para aquele merge.
- Não trate “feature pronta” como autorização de merge.
- Não faça force-push em branches compartilhadas.
- Antes de integrar, verifique diff, testes relevantes e estado do Git.

## Exceções especializadas

`loop/LOOP.md` e `triagem/TRIAGEM.md` podem impor fluxos mais restritos aos seus próprios worktrees/branches. Essas regras especializadas complementam esta rule; não reduzem as proteções de `CLAUDE.md`.
