---
source: <origem verificável>
date: YYYY-MM-DD
type: <current-state|open-loop|decision|handoff>
provenance: <como foi observado ou derivado>
---

# Formato de memória V1

Os quatro campos acima são o frontmatter mínimo. Não há schema formal, registry, captura automática ou daemon. O corpo usa Markdown claro, factos datados e links para a fonte. `source` identifica a origem; `date` a data do registo; `type` a classe; `provenance` explica observação, transformação ou confiança.

Postgres é a autoridade única para dados persistentes do CRM. Estes ficheiros são contexto operacional e podem ser reprocessados; não são uma segunda fonte de verdade.
