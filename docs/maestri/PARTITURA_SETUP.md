# Partitura — Lumenva Engineering Council

Nome recomendado: **Lumenva Engineering Council**

## Layout

```text
                     [ NOTE: TASK / MIGRATION ]
                               │
                               ▼
                    [ CLAUDE CODE — MAESTRO ]
                       /        |        \
                      /         |         \
                     ▼          ▼          ▼
          [ CODEX BUILDER ] [ GEMINI ] [ REVIEWER ]
                     \          |          /
                      \         |         /
                       └───────┬─┘
                               ▼
                        [ QA SHELL ]
```

## Terminais

### 1. Claude Code — Maestro
- Agent preset: Claude Code.
- Role: `Claude Maestro`.
- Maestro Mode: **ON**.
- Environment: control plane do workspace.
- Conectar às notes `TASK_TEMPLATE` e `GOOGLE_MIGRATION` quando aplicável.

### 2. Codex — Builder
- Agent preset: Codex CLI.
- Role: `Codex Builder`.
- Environment: Floor/worktree isolado.
- Recrutado sob demanda.

### 3. Gemini — Google Executor
- Agent preset: Gemini CLI.
- Role: `Gemini Google Executor`.
- Environment: Floor/worktree isolado.
- Recrutado somente quando a task for Google/Firebase/GCP ou quando o Maestro justificar.

### 4. Reviewer
- Agent preset: Codex ou Gemini.
- Role: `Independent Reviewer`.
- Sessão limpa.
- Preferir modelo diferente do executor principal.

### 5. QA Shell
- Terminal simples, sem agente LLM.
- Executa apenas o perfil de verificação decidido pelo Maestro.
- Não recebe secrets além do mínimo necessário ao ambiente de teste.

## Notes

Crie uma Note no Maestri a partir do conteúdo de:
- `docs/maestri/notes/TASK_TEMPLATE.md`
- `docs/maestri/notes/GOOGLE_MIGRATION.md`

Conecte a note da task ao Maestro, executor, reviewer e QA quando necessário.

## Floors

Uma task = um Floor/worktree.

Nome sugerido:
`task/<slug-curto>`

Não reutilizar Floor de uma task encerrada para uma task nova com outro objetivo.

## Como salvar a Partitura

1. Monte os cinco blocos no canvas.
2. Atribua as Roles usando os prompts em `docs/maestri/roles/`.
3. Ative Maestro Mode apenas no Claude.
4. Conecte a Note central.
5. Selecione os blocos e conexões.
6. Clique com o botão direito → **Partituras → Create New**.
7. Nome: `Lumenva Engineering Council`.
8. Revise os startup commands antes de salvar. Não inclua tokens, paths privados ou hostnames sensíveis.

A Partitura é um blueprint do canvas, não backup de estado. Floors/ambientes continuam sendo criados por task.