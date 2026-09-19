# MISSION — Lumenva Agentic Engineering OS

Status: rascunho, aguardando consenso com o Executor sobre o estado real do código e branches.

## O que queremos construir

Um sistema de engenharia confiável para transformar intenção do Dono em mudanças verificadas no Lumenva:

```text
Dono → Maestri → Claude Maestro → task pequena → Floor isolado
     → Codex Builder → verifier determinístico → Reviewer independente
     → retry bounded ou bloqueio → Human Gate → merge/deploy autorizado
```

O sistema deve ser observável, econômico em contexto/tokens, recuperável após crash, isolado, reutilizável e seguro. Deve distinguir atividade de conclusão e nunca aceitar o auto-relato de um agente como evidência.

## Por que

O Lumenva já possui Agent Engine, governança de agentes, event log, workers, documentação, testes e múltiplas linhas de trabalho. A missão é consolidar essas capacidades sem criar um segundo engine, sem misturar branches e sem permitir que a automação publique alterações críticas sem aprovação humana.

## Fontes de verdade

- Código e testes do checkout/branch canônico, após auditoria do Executor.
- Documentação versionada e contratos de domínio.
- Postgres/CRM e schema real para estado de produto.
- Event log para fatos de execução.
- MISSION/ARCHITECTURE/DECISIONS/ROADMAP/TASKS/RUNLOG/BLUEPRINT como notas governadas; cada nota tem autoridade e finalidade próprias.

## Princípios

- Audit first; reuse before create.
- Um Maestro permanente, um Builder Codex sob demanda e um Reviewer temporário.
- Verifier é processo determinístico, não agente LLM adicional.
- Task pequena, escopo congelado, acceptance testável e limite de tentativas.
- Sem arquitetura paralela sem justificativa e aprovação.
- Sem secrets em contexto/log/evidence.
- Human Gate antes de merge, deploy, produção, delete, migration destrutiva, secrets, auth crítica, infraestrutura irreversível ou gasto relevante.

## Definition of Done

Task somente termina com acceptance cumprido, verification apropriada aprovada, Reviewer PASS, documentação atualizada, evidência persistida, riscos conhecidos reportados e Human Gate satisfeito quando aplicável.

## Pendência do rascunho

O Executor precisa confirmar branch/checkout canônico, o que está em `main`, o que está verificado, parcial, bloqueado ou duplicado. Essas informações serão incorporadas sem contradizer a arquitetura do Agentic Engineering OS.
