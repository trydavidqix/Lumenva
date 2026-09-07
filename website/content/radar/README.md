# Lumenva Radar — guia editorial

O Radar é file-backed e gratuito na V1. Novos artigos entram em `articles.ts` usando os contratos de `lib/radar/types.ts`.

## Regras
- Nunca inventar notícia, métrica, cliente, fonte ou afirmação de produto.
- Notícias atuais precisam de fontes verificáveis em HTTPS.
- `slug` é único e estável.
- `publishedAt` usa `YYYY-MM-DD`.
- Todo artigo tem pelo menos uma fonte.
- Usar apenas a identidade visual definida em `website/DESIGN.md` e tokens existentes.
- A integração com Lumenva Social é posterior e deve referenciar o slug/URL canónico, não duplicar o artigo.
