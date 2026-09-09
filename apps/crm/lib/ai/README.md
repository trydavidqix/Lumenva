# lib/ai/

> Placeholder. Implementação real virá da Spec 05 — IA Conversacional + RAG + Handoff.

Escopo previsto:

- `gateway.ts` — resolução de modelo; em produção os agentes usam provider OpenAI direto via credencial/env, com Gateway/OpenRouter apenas quando configurados
- `agent.ts` — orquestrador do chatbot por tenant (carrega config de `ai_agents`)
- `rag/`
  - `ingest.ts` — pipeline de ingestão (FAQ + política + catálogo Nuvemshop + conversas resolvidas)
  - `embed.ts` — wrapper OpenAI `text-embedding-3-large`
  - `retrieve.ts` — query top-K em `ai_chunks` (pgvector) + reranking
- `sentiment.ts` — análise binária alta/baixa frustração via Haiku 4.5
- `handoff.ts` — política de transição bot → humano (threshold + audit em `crm_lead_activities.type='handoff_triggered'`)

## Strings de modelo (canônicas)

- `"openai/gpt-5.6-terra"` — agente principal em produção (os seis agentes publicados)
- `"openai/gpt-5-mini"` — opção OpenAI exposta no editor
- `"anthropic/claude-sonnet-4-6"` / `"anthropic/claude-haiku-4-5"` — fallback/compatibilidade quando configurado
- `"openai/text-embedding-3-large"` — embeddings RAG

O runtime escolhe a cadeia configurada: em produção `AI_GATEWAY_API_KEY` e
`OPENROUTER_API_KEY` estão vazias, `OPENAI_API_KEY` é o provider direto dos
agentes/embeddings/transcrição e `ANTHROPIC_API_KEY` fica disponível como fallback.
Trocas de versão publicada seguem `draft -> fn_publish_ai_agent_version`; UPDATE
direto é bloqueado pelo trigger de imutabilidade.
