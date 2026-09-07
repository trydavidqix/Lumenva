# Plano completo de implementação — Lumenva Radar

> Planejamento somente. Nenhum código, deploy, merge ou teste será executado nesta fase.

## Objetivo e limites

Completar o hub editorial em `website/`, na branch `blog`, com conteúdo file-backed, rotas, pesquisa local, SEO, RSS, newsletter honesta, telemetry existente, acessibilidade, documentação e evidência final.

- `main` permanece intacta.
- Sem CMS, busca, analytics, imagens ou newsletter pagos.
- Sem dependência runtime de `lumenva-social`.
- Sem conteúdo factual inventado.
- Dependência nova somente após justificativa e aprovação.
- TDD para helpers, componentes, rotas e contratos.

## Baseline a auditar

Já há partes das Tasks 1–10, E2E básico e documentação inicial. Nada disso é PASS até gate no SHA final. Primeiro registrar branch, SHA, worktree, status e divergência com `main`.

## Fase 0 — contrato único

Resolver drift entre spec (`body`, `readingMinutes`, `cover`) e branch (`blocks`, `readingTime`, `coverImage`). Escolher um contrato, então alinhar tipos, conteúdo, helpers, rotas, testes e docs. Contrato final deve cobrir:

- slug, title, subtitle, excerpt;
- type: `noticia | insight | guia`;
- category, tags, `publishedAt`, `updatedAt`;
- tempo de leitura, featured e cover;
- SEO opcional;
- fontes HTTPS;
- blocos paragraph, heading, bullets, quote, callout e image.

Criar invariantes: slug único, datas ISO, tempo positivo, fontes seguras, títulos/excerpts não vazios e tipos válidos.

## Fase 1 — domínio e conteúdo

Arquivos: `website/lib/radar/types.ts`, `website/content/radar/articles.ts`, `website/content/radar/quick.ts`, `website/lib/radar/articles.ts`, `website/lib/radar/search.ts`, `website/lib/radar/related.ts`.

Implementar e testar:

1. Registro newest-first, slug como desempate.
2. Busca accent/case-insensitive em title, excerpt, category, type e tags.
3. Busca vazia preserva ordem canônica.
4. Filtros por tipo/categoria e slugs de categoria estáveis.
5. Related determinístico, sem atual nem duplicados.
6. Conteúdo representativo dos três tipos, sem claims inventados.

Gate: testes unitários focados + `pnpm typecheck`.

## Fase 2 — navegação e UI

Auditar fonte de navegação. Integrar `/radar` em desktop, mobile e footer sem duplicar listas.

Criar ou consolidar: Hero, FeaturedArticle, CategoryNav, ArticleCard, ArticleList, QuickRadar, TrendingTopics, RadarSearch, NewsletterCTA, ArticleBody, ArticleSources, ShareActions, RelatedArticles e RadarListingPage.

Exigir props tipadas, client component somente quando necessário, markup semântico, foco visível, teclado, targets de 44 px, reduced motion, viewport 390 px e tokens existentes.

Gate: testes de home/artigo + lint + typecheck.

## Fase 3 — rotas

Implementar:

- `/radar` com hero, destaque, categorias, últimas publicações, quick radar, busca, temas e newsletter;
- `/radar/noticias`, `/radar/insights`, `/radar/guias` via listing compartilhada;
- `/radar/categoria/[slug]` com `generateStaticParams()` e `notFound()`;
- `/radar/[slug]` com `generateStaticParams()`, 404, breadcrumb, datas, leitura, subtitle, cover, body, fontes, tags, share e related.

Gate: testes de rotas/componentes + lint + typecheck.

## Fase 4 — SEO e distribuição

Arquivos: `website/lib/radar/metadata.ts`, `website/lib/radar/rss.ts`, `website/app/radar/rss.xml/route.ts`, `website/app/sitemap.ts`.

Implementar/testar canonical via `getSiteUrl()`, metadata OG/Twitter, Article JSON-LD, BreadcrumbList JSON-LD, serialização segura escapando `<`, sitemap de índice/seções/categorias/artigos e RSS UTF-8 com XML escapado, links canônicos e artigos publicados.

## Fase 5 — newsletter e telemetry

Auditar contato, Resend, rate limit, consentimento e persistência antes de codar.

- Email validado antes da rede.
- Sucesso/erro honestos.
- Source `radar` somente com persistência real.
- Sem coleta se destino não configurado; CTA informativa é válida e deve ser documentada.
- Usar telemetry já existente.
- Eventos: `radar_article_view`, `radar_related_click`, `radar_share_click`, `radar_newsletter_submit`, `radar_source_click`.
- Nunca enviar email cru ou PII desnecessária.

## Fase 6 — Social seam opcional

Após núcleo verde, decidir sobre GET read-only `/api/radar/articles` com somente slug, title, excerpt, URL, cover, type, tags e `publishedAt`. Sem DM, webhook, escrita Social ou segredo. Se adiado, registrar decisão e contrato futuro.

## Fase 7 — acessibilidade, visual e E2E

Cobrir home, navegação desktop/mobile, artigo, seções, categoria, 404, busca por teclado/acentos, RSS, foco, headings, targets e ausência de overflow em 390 px. Executar testes unitários/componentes, Playwright e verificação visual das rotas críticas.

## Fase 8 — documentação e evidência

Atualizar `website/content/radar/README.md`, `docs/runbooks/lumenva-website.md`, índices necessários e criar `docs/evidence/blog/radar-implementation-status.md` com SHA, branch, comandos, resultados, limitações e decisão Social.

## Gate final

Na branch `blog`, árvore limpa:

```bash
cd website
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

Depois confirmar:

```bash
git status --short --branch
git rev-parse HEAD
git rev-list --left-right --count blog...origin/blog
```

Verificar manualmente canonical `lumenva.pt`, sitemap, RSS, mobile 390 px, teclado, ausência de segredos/PII/claims inventados/vendors pagos e `main` intacta.

## Definition of Done

- Contrato único, conteúdo tipado e file-backed.
- Home, seções, categorias e artigos completos.
- Quick Radar, busca, related, fontes e share funcionais.
- Newsletter honesta; telemetry existente.
- Metadata, canonical, Article/Breadcrumb JSON-LD, sitemap e RSS válidos.
- Mobile, acessibilidade e performance verificadas.
- Unit, component, E2E, typecheck, lint e build verdes.
- Guia, runbook e evidência final presentes.
- Social separado ou adiamento documentado.
- Nenhum serviço pago novo; `main` não alterada.

## Fora de escopo

CMS; publicação Social; comentários/keywords/DMs; webhooks Instagram; monitoramento autônomo; agentes de pesquisa/fact-check; conversão automática para lead/CRM.

## Regra desta etapa

Somente este plano deve ser revisado. Implementação começa após aprovação explícita.
