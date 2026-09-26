---
source: PLANO-UNIFICADO-FINAL.md + master-blueprint-IMPLEMENTAVEL.md
date: 2026-09-12
type: architecture-contract
provenance: wave-2-birth-integration
---

# Agent Birth Pipeline — Psyche desde o dia 1

O pipeline compila, nesta ordem:

`Company Constitution → Policies → Department Rules → Role Contract → Big Five Personality → Emotional Baseline (PAD/Plutchik) → OCC Goals/Standards/Attitudes → Relationship Policy → Memory/Decay Policy → Skills → Tools → Current Task → Context Composer → Evals → Shadow → Approval → Published Agent Version`

## Artefactos obrigatórios

Cada `AgentDefinition` nasce com `psyche_id`, `psyche_version`, `personality_profile`, `emotional_baseline`, `occ_profile`, `relationship_policy`, `memory_decay_policy`, `affective_baseline` e `psyche_eval_suite`. `AGENT_CORE` é imutável; `AGENT_STATE` contém `goal`, `strategy`, `memory`, `affect`, `relationship` e `plan`.

## Gates

1. Big Five dentro de `[0,1]`, coerente com BehaviorContract.
2. PAD baseline válido; Plutchik é etiqueta derivada do mesmo evento, nunca motor concorrente.
3. OCC referencia goals, standards e attitudes existentes.
4. Relationship e memória têm tenant, provenance, TTL/decay e redaction.
5. Context Composer não inclui estado emocional sem sensitivity/confidence/token budget.
6. Evals provam que Psyche não muda autoridade, policy, factualidade ou tool scope.
