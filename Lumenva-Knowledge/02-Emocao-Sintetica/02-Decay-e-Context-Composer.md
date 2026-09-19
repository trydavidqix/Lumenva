---
source: owner-synthesis + psyche-os-plano
date: 2026-09-12
type: runtime-context-model
provenance: wave-16-plan
---

# Decay, relações e Context Composer

Memórias emocionais têm `strength`, `emotional_intensity`, `salience`, `half_life_hours`, `last_recalled_at` e provenance. Decay: `strength(t) = strength_0 * 2^(-(t-last_recalled_at)/half_life_hours)`. Expiração remove a memória do contexto, não apaga o evento histórico.

Relationship State mantém `trust`, `affinity`, `familiarity`, `interaction_count` e última interação. Updates são idempotentes, tenant-scoped e limitados; repair/forgiveness exigem evidência de interação.

Composer usa no máximo 15–20 blocos: policy, identidade, missão, behavior, autoridade, guardrails, objetivo, sessão, PAD, Plutchik, Big Five resumido, OCC, relação, memórias fortes, factos do cliente, canal, tools, último resultado, handoff e output schema. Policy, identidade, objetivo e estado crítico nunca são descartados por orçamento.

Hooks planeados: `preTurn` carrega/decai/appraises/compõe; `postTurn` classifica resultado, atualiza estado, propõe memória e grava trace. Não são Git hooks.
