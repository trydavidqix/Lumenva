-- 0125 — ai_agent_versions.composio_apps: toolkits Composio habilitados no turno
--
-- Integração Composio (docs.composio.dev) dá acesso a Google Calendar, Gmail,
-- Docs e Sheets (e 1000+ outros apps) sem precisar implementar OAuth próprio
-- por app — a Composio já gerencia a conta conectada e devolve tools prontas
-- pro Vercel AI SDK (pacote @composio/vercel). Decisão de produto: usar
-- Composio em vez de construir cada integração Google nativa (trade-off
-- registrado — depende de COMPOSIO_API_KEY, opcional, sem custo obrigatório
-- pro self-host que não configurar).
--
-- `composio_apps` é a lista de toolkit slugs (ex.: 'googlecalendar', 'gmail',
-- 'googledocs', 'googlesheets') que este agente pode usar no turno — mesma
-- semântica de `tool_ids` (catálogo MCP interno), mas pro catálogo externo da
-- Composio. Vazio = comportamento atual, sem nenhuma tool Composio no turno.

alter table public.ai_agent_versions
  add column if not exists composio_apps text[] not null default '{}';
