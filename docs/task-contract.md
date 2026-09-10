---
type: task-contract
version: 1
projects: [CRM, RouteLex, Helixforge, Lumenva Social]
---

# Contrato de tarefa

## Entrada e escopo

- **Tarefa:** <id e resultado em uma frase>
- **Fase:** <F1–F8 ou trabalho autorizado>
- **Owner:** <agente>; **revisor:** <QA>
- **In:** links, SHA/worktree e contexto mínimo.
- **Out:** ficheiros, serviços e ações explicitamente excluídos.

## DoD e prova

- Critérios observáveis: <lista curta>.
- Testes/checks: <comando e saída esperada>; subset rápido inferior a 2 min quando aplicável.
- Prova: comando executado, exit code, SHA/checkout, diff e limitações. `docs != prova`.

## Limites e estado

- Limites: tokens <...>, euros <...>, ciclos review→fix ≤ 2; ao atingir, fail-closed e escalar.
- Estado versionado: `PLANNED | IN_PROGRESS | BLOCKED | REVIEW | VERIFIED | DONE`.
- `idempotency_key`: <valor único>; repetir não duplica efeitos.
- Risco L0–L4 e autorização exigida: <nível/autoridade>.

## Escalada

Bloqueio, timeout, resposta vazia ou ausência de prova não é aceitação: marcar `BLOCKED`/`NAO PROVADO`, anexar evidência e indicar `PRECISA DONO`.
