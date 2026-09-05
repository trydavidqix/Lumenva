---
type: handoff
date: 2026-09-05
status: closed
audited_against: main @ 2d1c2450
---

# Handoff — sincronização documental de 2026-09-05

## Fechado

- Checkout Mac movido para `/Users/david/Desktop/Projetos/CRM/DeskcommCRM`;
  referências documentais ao caminho antigo foram corrigidas.
- Merge `e984d8b4` incorporou as branches de documentação e importação. O
  importador confirmou 40 leads reais, `Novo (frio)`, `prospector_sheets` e 0
  duplicatas.
- Incidente dos sidecars documentado em `runbooks/mem0.md` e
  `runbooks/graphiti.md`: causa (deploy sem profiles em 2026-09-03), volumes
  preservados, restore e comandos reproduzíveis.
- `docs/runbooks/deploy.md` já contém os profiles obrigatórios em `2d1c2450`.
- Flags `graphiti` e `mem0` permanecem `shadow`; não houve ativação.

## VPS

O checkout `/root/deskcommcrm` foi alinhado com `origin/main` por `git pull`.
`mem0-src/` é clone local do source usado para construir
`mem0-api-server:local`; no checkout VPS foi adicionado a `.git/info/exclude`
para manter o `git status` limpo sem alterar `origin/main`. A branch deste
handoff também adiciona a regra ao `.gitignore` para a próxima sincronização.
Nenhum deploy, restart de container ou alteração de `.env` faz parte deste
handoff.

## Pendências

Nenhuma decisão de remoção foi tomada para artefactos de pesquisa locais; os
diretórios de sessão são ignorados pelo Git e permanecem no disco para decisão
posterior do dono.
