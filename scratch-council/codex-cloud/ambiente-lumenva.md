# Ambiente Codex Cloud — Lumenva

- Nome: trydavidqix/Lumenva
- ENV_ID: 6aa57726ade881919b0e02786359a0c3
- Criado: 2026-09-12, via chatgpt.com/codex (iPhone do dono)
- Config: imagem universal, sem secrets, acesso à internet DESATIVADO, script de setup automático, cache de container ATIVADO
- Uso: tarefas leves/isoladas (pesquisa, análise, patches pequenos revisados via diff/PR) — NUNCA segredos, migrações ou produção (isso continua no worker Linux via Maestri)

## Como usar
codex cloud exec --env 6aa57726ade881919b0e02786359a0c3 "texto da tarefa aqui, incluir o goal/skill dentro do prompt"
codex cloud status <TASK_ID>
codex cloud list --json
