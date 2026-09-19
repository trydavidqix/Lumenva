# MISSION — Lumenva Agentic Engineering OS

Status: definitivo; aprovado pelo Dono em 2026-09-16. O Agentic OS ainda não foi implementado; este documento governa planejamento e consolidação.

## O que queremos construir

Um sistema de engenharia confiável para transformar intenção do Dono em mudanças verificadas no Lumenva:

```text
Dono → Maestri → Claude Maestro → task pequena → Floor isolado
     → Codex Builder → verifier determinístico → Reviewer independente
     → retry bounded ou bloqueio → Human Gate → merge/deploy autorizado
```

O sistema deve ser observável, econômico em contexto/tokens, recuperável após crash, isolado, reutilizável e seguro. Atividade de agente nunca equivale a conclusão; somente acceptance, evidence, verification e review permitem avançar.

## Por que

O Lumenva possui múltiplas branches/worktrees de remediation e partes de runtime, mas a baseline ainda precisa ser reconciliada. O Agentic Engineering OS deve consolidar o que existe sem criar um segundo Agent Engine, sem misturar branches e sem permitir publicação crítica sem aprovação humana.

## Fontes de verdade

- Código, testes, migrations e infraestrutura efetivamente presentes no checkout/branch canônico após V0.
- `main` remoto atualmente em `fec2d253`; nenhuma branch remediation foi absorvida em `main` no momento desta nota.
- Postgres/CRM e schema real para estado de produto.
- Event log para fatos de execução.
- Notas governadas: `MISSION.md`, `BLUEPRINT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `ROADMAP.md`, `TASKS.md`, `RUNLOG.md`.

## Princípios

- Audit first; reuse before create.
- Exatamente um Maestro permanente, um Builder Codex sob demanda e um Reviewer temporário.
- Verifier é processo determinístico, não agente LLM adicional.
- Task pequena, escopo congelado, acceptance testável e limite máximo de 3 attempts.
- Sem arquitetura paralela sem justificativa e aprovação.
- Sem secrets em contexto, logs ou evidence.
- Human Gate antes de merge, deploy, produção, delete, migration destrutiva, secrets, auth crítica, infraestrutura irreversível ou gasto relevante.

## Definition of Done

Task somente termina com acceptance cumprido, verification apropriada aprovada, Reviewer PASS, documentação atualizada, evidence persistida, riscos conhecidos reportados e Human Gate satisfeito quando aplicável.

## Estado inicial confirmado

- Branches remediation são baseline **V0**, não Agentic OS V1.
- O trabalho de remediation ainda não foi incorporado em `main`.
- Branches canônicas provisórias: `business-os-reconcile-equivalence`, `waves-1-9`, `ai-creator-commerce`, `remaining-entitlements-operating-core`.
- Há 19 testes direcionados passando em `business-os-audit-stripe`, além de typecheck/lint incremental e `git diff --check`; isso é evidência local, não CI verde.
- CI remoto está vermelho/incompleto; a suíte completa não terminou; Docker indisponível para o teste dependente dele.
- As outras 14 branches não tiveram CI executado.
- Há duplicações de correção, waves sobrepostas, colisões de nome/timestamp de migration e testes com path hardcoded para migration antiga.
