---
source: owner-synthesis + PLANO-UNIFICADO-FINAL.md
date: 2026-09-12
type: synthetic-emotion-model
provenance: psycheos-wave-16-plan
---

# PAD, Plutchik e OCC

PAD é o estado contínuo para cálculo: `pleasure`, `arousal`, `dominance`, `intensity`. Plutchik é a etiqueta discreta para explicação, UI e logging: alegria, confiança, medo, surpresa, tristeza, aversão, raiva e antecipação, com intensidade.

Os dois representam o mesmo evento. Uma transição PAD produz uma etiqueta Plutchik; não existem dois motores de emoção concorrentes.

OCC faz appraisal sobre goals, standards e attitudes: desejabilidade, probabilidade, agência, controlabilidade e relação com normas. O appraisal é inferência com provenance, nunca facto clínico nem diagnóstico.

Pipeline por turno: mensagem/objetivo → OCC → transição PAD limitada → etiqueta Plutchik → resposta sob BehaviorContract → evento append-only.
