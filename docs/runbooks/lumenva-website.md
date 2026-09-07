---
type: runbook
project: Lumenva website
status: active
last_updated: 2026-09-07
---

# Lumenva website — operação

## Estado confirmado

| Área | Estado |
|---|---|
| Site público | `https://lumenva.pt` responde por HTTPS na Vercel |
| `www` | `https://www.lumenva.pt` redireciona para `https://lumenva.pt` |
| Projeto Vercel | `lumenva-website` no time `trydavidqixs-projects` |
| Código-fonte | diretório `website/` deste repositório |
| Formulário | `POST /api/contact` validado e com limite de 5 pedidos por IP a cada hora |
| Radar | implementado na branch `blog` em `/radar`; publicação em produção depende de merge/deploy posterior aprovado |
| `robots.txt` / `sitemap.xml` | gerados por `app/robots.ts` / `app/sitemap.ts`; o sitemap da branch `blog` inclui Radar, taxonomias e artigos |
| RSS Radar | `/radar/rss.xml` |
| Proteção de deploy Vercel | SSO Protection ativa, com domínio público personalizado |

## Lumenva Radar

O Radar é file-backed na V1 e não introduz CMS, pesquisa, analytics ou newsletter pagos. O conteúdo editorial fica em `website/content/radar/`. O contrato canónico está em `website/lib/radar/types.ts` e o guia de autoria em `website/content/radar/README.md`.

Rotas principais: `/radar`, `/radar/noticias`, `/radar/insights`, `/radar/guias`, `/radar/categoria/[slug]`, `/radar/[slug]` e `/radar/rss.xml`.

Para publicar um artigo: adicione um registo tipado a `content/radar/articles.ts`, use slug único, data ISO, fontes HTTPS verificáveis e conteúdo factual. Nunca invente notícia, métricas, clientes ou afirmações de produto. O sitemap, RSS, categorias e páginas de artigo derivam do mesmo registo.

A caixa de newsletter permanece informativa até existir destino de subscrição confirmado na infraestrutura atual. Não recolher emails sem persistência/consentimento definidos. A futura integração com `lumenva-social` deve usar o slug/URL canónico do Radar; Social não é dependência da V1.

## Gate do Radar

Executar em `website/`:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

Também confirmar manualmente: layout a 390 px sem overflow, navegação por teclado, `/radar/rss.xml` com XML válido, sitemap contendo artigos e canonical apontando para `lumenva.pt` quando `NEXT_PUBLIC_SITE_URL=https://lumenva.pt`.

## Domínio, DNS e e-mail

O DNS de `lumenva.pt` é gerido na Cloudflare e o domínio está associado ao projeto `lumenva-website`. Não remover registos MX: pertencem ao Cloudflare Email Routing e mantêm `contato@lumenva.pt`. O domínio de envio do Resend deve permanecer verificado.

Variáveis necessárias na Vercel: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` e `NEXT_PUBLIC_SITE_URL`. Segredos nunca pertencem ao repositório.

## Rotina de verificação

Após alteração de domínio, e-mail ou deploy, confirme `https://lumenva.pt` HTTP 200, redirecionamento de `www`, formulário de contacto, domínio Vercel configurado e `NEXT_PUBLIC_SITE_URL=https://lumenva.pt`.

## Incidente conhecido: `NEXT_PUBLIC_SITE_URL`

Em 2026-08-12 a variável apontou temporariamente para preview Vercel e contaminou canonical/JSON-LD. Após deploy, `curl -s https://lumenva.pt/<rota> | grep canonical` deve devolver `lumenva.pt`, nunca `*.vercel.app`.
