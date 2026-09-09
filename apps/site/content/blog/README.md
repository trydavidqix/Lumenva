# Blog Lumenva

Blog é extensão editorial do site institucional. Site e blog mantêm fronteiras claras:

- Site institucional expõe somente link/flag `Blog` para `/blog`.
- Conteúdo, rotas, componentes, metadados, RSS e testes do blog vivem sob o escopo blog.
- Blog não altera páginas, copy, navegação ou telemetria editorial do site além do link de entrada.

## Rotas públicas

- `/blog` — página inicial e busca local.
- `/blog/noticias` — notícias.
- `/blog/insights` — análises e insights.
- `/blog/guias` — guias práticos.
- `/blog/categoria/:slug` — filtro por categoria.
- `/blog/:slug` — artigo.
- `/blog/rss.xml` — feed RSS.

## Publicação

1. Adicionar artigo ao registro file-backed do blog.
2. Validar slug único, categoria, tags, data e tempo de leitura.
3. Executar `pnpm typecheck`, `pnpm test` e `pnpm test:e2e` em `apps/site/`.
4. Abrir `/blog`, uma categoria, um artigo e `/blog/rss.xml`.
5. Verificar viewport de 390 px e navegação por teclado antes de pedir revisão.

Não publicar conteúdo sem fonte, data e responsável editorial definidos. Newsletter permanece sem coleta até existir destino aprovado e configurado.

## Validação automatizada

`apps/site/tests/e2e/blog.spec.ts` cobre homepage, categorias, busca, artigo, breadcrumb/JSON-LD, RSS, landmarks acessíveis e viewport mobile.
