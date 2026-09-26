---
description: Executa UMA sessão do gov-loop do DeskcommCRM (uma feature de governança, depois morre)
---
Execute o protocolo do gov-loop — DeskcommCRM (Governança de Atendimento): leia
tooling/agent-loop/LOOP.md e siga-o à risca. Lane única: core.

Lembretes que valem antes mesmo de ler o arquivo: uma sessão entrega UMA feature;
o estado vem do disco e volta pro disco; gov-verifier antes de qualquer passes:true
(features.json só muda via node tooling/agent-loop/update-feature.ts); você nunca faz git push;
a política de execução está em `CLAUDE.md`, nas rules aplicáveis e em `tooling/agent-loop/LOOP.md`; o comportamento de produto vem das specs e business rules canônicas citadas pelo briefing.
