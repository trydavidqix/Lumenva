# Content OS editorial V1

O pipeline editorial roda apenas no servidor e mantém o estado recuperável no
PostgreSQL/Supabase:

```text
RSSHub -> sinais -> research run -> evidências/claims -> fact-check
       -> writer -> quality gate -> content_item draft
       -> publication_job -> Postiz -> confirmação -> publicado
```

## Entradas e execução

- `POST /api/internal/content/editorial` inicia ou retoma um run. Exige
  `x-internal-secret` (ou Bearer), `x-organization-id` e `topic`.
- `POST /api/v1/cron/content-editorial` coleta uma fonte RSSHub; o mesmo cron
  reconcilia runs persistidos.
- `GET /api/v1/cron/content-intelligence` recolhe todas as fontes ativas
  controladas, isolando falhas por tenant/provider.
- `GET /api/v1/cron/content-intelligence` executa o worker privado agendado
  para todas as fontes ativas RSSHub e changedetection: normaliza, deduplica e
  persiste sinais/oportunidades por tenant, isolando falhas por fonte.
- `GET /api/v1/cron/content-publication` processa jobs de publicação em fila.
  O cron aceita `INTERNAL_CRON_SECRET` ou `INTERNAL_SECRET`.
- `GET /api/v1/cron/content-metrics` recolhe snapshots normalizados das
  publicações confirmadas.
- `GET /api/v1/cron/content-learning` identifica queda de desempenho e cria
  candidatos idempotentes de atualização para artigos publicados.
- O compose de produção agenda coleta editorial e intelligence a cada 10 minutos e publicação
  a cada 2 minutos, métricas a cada 30 minutos e aprendizagem a cada 6 horas.

Sem credencial de modelo, o writer cria um rascunho explicitamente marcado
`mode: fallback`; esse rascunho nunca chama o publisher externo. Com um modelo
configurado, a resposta é validada contra o contrato estruturado antes de ser
persistida.

## Configuração privada

As URLs e chaves `CONTENT_OS_*` são server-side. Não devem aparecer no browser,
em logs ou em `content_sources`. Configure-as pelo secret manager da instalação:

- `CONTENT_OS_RSSHUB_BASE_URL` e `CONTENT_OS_RSSHUB_ACCESS_KEY`;
- `CONTENT_OS_POSTIZ_BASE_URL` e `CONTENT_OS_POSTIZ_API_KEY`;
- `CONTENT_OS_COMFY_BASE_URL` e `CONTENT_OS_COMFY_API_KEY`;
- `CONTENT_OS_VIDEO_COMPOSER_BASE_URL` e `CONTENT_OS_VIDEO_COMPOSER_API_KEY`;
- uma credencial de modelo (`AI_GATEWAY_API_KEY`, `OPENROUTER_API_KEY`,
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` ou `GOOGLE_API_KEY`).

## Gate de schema

As migrations `20260907100000_0158_content_os_editorial_persistence.sql` e
`20260907110000_0159_content_os_learning_idempotency.sql` precisam ser aplicadas
no Supabase antes de ativar os crons. A sincronização remota deve ser revisada e
executada separadamente; este branch não aplica migrations nem faz merge para
`main`.

## Verificação local

```text
pnpm exec tsc --noEmit
pnpm exec vitest run tests/unit/content-os-provider-adapters.test.ts lib/content-os/orchestrator.test.ts tests/unit/content-os-publication-service.test.ts
```
