---
type: open-loops
project: Lumenva
last_updated: 2026-09-09
audited_against: main @ 2341dd517967b58b9c50bb326b8c8f974d2d5dff
source_note: itens abaixo são pendências observadas em documentação existente; não foram marcados como concluídos sem prova nova nesta F1
---

# Open loops — baseline F1

Esta lista preserva pendências que continuam sem prova de encerramento no baseline. A presença de um item não é uma afirmação de falha atual; cada loop precisa de reprodução, evidência e decisão própria.

- **Voz/SIP:** a prova de conversa ponta a ponta e a causa do loop de repetição continuam sem validação nova nesta F1.
- **Twilio Trial / ligação de saída:** a limitação de conta permanece um bloqueador documentado até existir capacidade e teste autorizado.
- **Mem0/Graphiti:** as flags de produção permanecem atrás de rollout; promoção para `on` não foi feita nem provada nesta F1.
- **Deploy/runtime:** não há prova nesta F1 de que imagens, containers ou VPS estejam alinhados ao SHA do baseline.
- **Suítes dependentes de serviços:** `test:db`, `test:e2e` e provas visuais não foram executados nesta F1; seus resultados permanecem não provados aqui.
- **Dependências e worktrees:** qualquer limpeza, remoção de duplicatas ou encerramento de worktree requer nova reconciliação e autorização própria.

## Regra de encerramento

Um loop só pode mudar para concluído quando houver comando ou artefato reproduzível, código de saída, SHA/ambiente identificável e revisão correspondente. Ausência de erro, snapshot antigo ou relato de sessão não é prova suficiente.
