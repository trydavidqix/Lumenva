---
source: agentmemory-mcp-and-memory-md-audit
date: 2026-09-10
type: decision
provenance: now-tier-gap-analysis
---

# Gap note: agentmemory MCP + MEMORY.md

`MEMORY.md` fornece índice e contexto durável para o agente. O plugin `agentmemory` MCP cobre os eventos de memória que já estão integrados ao runtime. Esta V1 não duplica esses eventos nem adiciona hooks.

O que permanece manual/não coberto por esta combinação: convenção única de nomes e frontmatter, estado corrente/loops do CRM, declaração explícita de Postgres como autoridade, reconciliação entre ficheiro e dado relacional, e a prova de que um registo foi observado no checkout/SHA certo. Esta gap note não constrói Gateway, Context Builder, backend adicional, lifecycle ou captura automática.

Quando houver divergência, Postgres vence para dados do CRM; o Markdown é corrigido com proveniência. Reavaliar apenas pelo gatilho operacional aprovado, não por calendário.
