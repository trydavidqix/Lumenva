-- 0124 — ai_chunks.embedding: 1536 -> 2048 dims
--
-- lib/ai/embed.ts ganhou um override de embedding pra self-host free-tier
-- (EMBEDDING_BASE_URL/EMBEDDING_API_KEY/EMBEDDING_MODEL_ID — ver 648b5e82 e
-- docs/runbooks/ai-platform-secrets.md). O provider validado (NVIDIA Build,
-- nvidia/nemotron-3-embed-1b) devolve vetores de 2048 dimensões, não 1536
-- (o tamanho do default openai/text-embedding-3-small). A coluna era fixa em
-- vector(1536), então todo upsert de chunk com esse provider falhava com
-- "expected 1536 dimensions, not 2048" — confirmado ao vivo nas versões 11-15
-- de ai_knowledge_versions para o agente Alfred (Lumenva), todas com
-- total_chunks=0.
--
-- Seguro de rodar: ai_chunks está vazia (todo upsert até aqui falhou), então
-- não há dado de 1536 dims pra migrar/perder.
--
-- retrieve_top_k_chunks (0097) já recebe p_embedding como "vector" genérico,
-- sem typmod fixo — typmod de parâmetro de função não é reforçado pelo
-- Postgres como em coluna de tabela, então a RPC não precisa mudar.
--
-- Sem índice ANN por enquanto: ivfflat (e hnsw) no pgvector têm teto de 2000
-- dimensões, e 2048 > 2000. Numa base deste tamanho (dezenas de chunks por
-- tenant self-host) um scan sequencial de cosine distance é irrelevante em
-- custo; se o volume crescer a ponto de precisar de ANN, trocar pra um
-- provider de embedding com <=2000 dims é o caminho, não forçar o índice aqui.

drop index if exists public.ai_chunks_embedding_ivfflat_idx;

alter table public.ai_chunks
  alter column embedding type vector(2048);
