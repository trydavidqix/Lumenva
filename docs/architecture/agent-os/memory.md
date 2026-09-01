# Memory

## Authority model

Memory is derived context, not authoritative business state.

```text
Postgres/CRM authoritative state  >  published knowledge/RAG  >  derived memory/graph  >  model prior knowledge
```

When sources conflict, the higher-authority source wins.

## Memory categories

- **Short-term/session context** — current run/conversation state.
- **Episodic memory** — notable past interactions/events.
- **Semantic memory** — derived stable facts/preferences.
- **Procedural knowledge** — belongs in Skills, not memory.
- **Graph projection** — relationships/temporal facts derived from authoritative data.

## Write policy

Memory writes are explicit and attributable to a run. A memory write policy determines which categories may be created/updated automatically. Sensitive or uncertain facts should be proposed/verified rather than silently promoted as truth.

## Privacy and tenancy

Every memory record/projection is tenant-scoped and subject to LGPD retention/deletion rules. External memory providers receive the minimum necessary data and remain replaceable projections.

## External systems

Mem0/Graphiti or equivalents may be used behind provider ports for projection/retrieval. They are optional and rebuildable from authoritative sources where feasible.
