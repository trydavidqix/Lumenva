---
source: local-synthesis
date: 2026-09-12
type: system-index
provenance: owner-request-wave-16
---

# PsycheOS — índice

PsycheOS é a camada de personalidade e emoção sintética que nasce dentro do Agent Birth Pipeline. Não é um add-on posterior: cada AgentDefinition recebe um `psyche_id`, um perfil imutável e estado mutável separado desde a Wave 2. A implementação concreta permanece planeada para a Wave 16, depois das Waves 0–15.

## Domínios

- [[01-Tracos-de-Personalidade/01-Big-Five-e-Behavior-Contract]]
- [[02-Emocao-Sintetica/01-PAD-Plutchik-OCC]]
- [[02-Emocao-Sintetica/02-Decay-e-Context-Composer]]
- [[03-Por-Agente/00-Contrato-de-Nascimento-Psyche]]
- [[03-Por-Agente/sales-agent]]
- [[04-Pesquisa-Bruta/00-Fontes-e-estado-da-pesquisa]]

## Invariantes

Psyche nunca concede autoridade, altera instruction hierarchy, decide aprovação, muda factualidade, preço, compliance, guardrails ou limites financeiros. Postgres continua a fonte única da verdade; `organization_id` continua o tenant canónico com RLS.
