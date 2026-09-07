# Lumenva Radar — evidência de implementação

## Estado

- Branch: `blog`
- `main`: não alterada
- Conteúdo: file-backed em `website/content/radar/`
- Newsletter: CTA honesta; não recolhe emails sem destino configurado
- Social: seam GET read-only em `/api/radar/articles`; sem escrita, DM ou webhook

## Gates executados

Executados a partir de `website/`:

- `pnpm test`: PASS — 19 arquivos, 40 testes
- `pnpm typecheck`: PASS
- `pnpm lint`: PASS com warning preexistente em `app/icon.tsx` sobre directiva eslint não utilizada
- `NEXT_PUBLIC_SITE_URL=https://lumenva.pt pnpm build`: PASS — rotas Radar geradas
- `pnpm test:e2e`: PASS — 16 testes
- `pnpm exec playwright test tests/e2e/radar.spec.ts`: PASS — 4 testes Radar
- `git diff --check`: PASS

## Cobertura Radar verificada

- Homepage `/radar`
- Seções `/radar/noticias`, `/radar/insights`, `/radar/guias`
- Categorias dinâmicas
- Artigos dinâmicos e 404 por slug desconhecido
- Busca local accent/case-insensitive
- Related determinístico
- Fontes externas com `noopener noreferrer`
- Share nativo
- Article e Breadcrumb JSON-LD
- Sitemap e RSS
- API pública read-only de metadados
- Navegação e testes E2E existentes
- Componentes de home e artigo

## Limitações

- Não houve deploy nem merge em `main`.
- Verificação visual manual fora do Playwright não foi executada.
- O warning de `app/icon.tsx` não bloqueia lint e não pertence ao Radar.
