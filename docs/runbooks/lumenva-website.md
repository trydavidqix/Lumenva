---
type: runbook
project: Lumenva website
status: active
last_updated: 2026-08-12
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
| Confirmação ao visitante | enviada por Resend |
| Aviso interno | enviado para `contato@lumenva.pt` e encaminhado pela Cloudflare para `lumenva.group@gmail.com` |
| `robots.txt` / `sitemap.xml` | gerados por `app/robots.ts` / `app/sitemap.ts` (Next.js `MetadataRoute`); confirme `200` em ambos após deploy |
| Proteção de deploy Vercel | SSO Protection ativa, mas com exceção `all_except_custom_domains` — `lumenva.pt` fica público; os domínios `*.vercel.app` do projeto exigem login e não devem ser usados como alvo de auditoria/crawler |

## Domínio e DNS

O DNS do domínio `lumenva.pt` é gerido na Cloudflare. O domínio está associado ao projeto
`lumenva-website` na Vercel; a Vercel valida a configuração atual por registos A.

Não remover nem substituir os registos MX do domínio. Eles pertencem ao Cloudflare Email
Routing e mantêm o encaminhamento de `contato@lumenva.pt` para o Gmail de destino.

O domínio de envio do Resend continua verificado. Os registos de verificação e de envio do
Resend devem ser preservados.

## E-mail do formulário

O formulário usa a rota `website/app/api/contact/route.ts`. Depois da validação e do limite
de pedidos, ele envia duas mensagens:

1. Uma confirmação ao endereço informado pelo visitante.
2. Um aviso interno com assunto `Novo contato: <nome>` para `contato@lumenva.pt`.

O envio é feito com Resend usando `contato@lumenva.pt` como remetente. O endereço de aviso
interno é encaminhado gratuitamente pela Cloudflare Email Routing para
`lumenva.group@gmail.com`.

Variáveis necessárias na Vercel, em Production e Preview:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `NEXT_PUBLIC_SITE_URL`

Os valores e as chaves não pertencem ao repositório. Nunca os coloque em documentação,
commits ou ficheiros rastreados pelo Git.

## Rotina de verificação

Após uma alteração de domínio, e-mail ou deploy, confirme:

1. `https://lumenva.pt` responde com HTTP 200.
2. `https://www.lumenva.pt` redireciona para o domínio principal.
3. Um envio de teste pelo formulário gera a confirmação ao visitante e o aviso interno no
   Gmail de destino.
4. Na Vercel, o domínio aparece como `configured-correctly`.

## Diagnóstico rápido

Se a confirmação chega ao visitante, mas o aviso interno não chega ao Gmail:

1. Verifique no Resend o estado da mensagem `Novo contato: ...`.
2. Se o estado for `suppressed`, consulte a suppression list. Um bounce anterior pode ter
   bloqueado automaticamente `contato@lumenva.pt`.
3. Antes de remover uma suppression, confirme que os MX da Cloudflare Email Routing estão
   ativos e que a regra `contato@lumenva.pt` para `lumenva.group@gmail.com` está ativa.
4. Remova somente a suppression desse endereço e faça um novo teste controlado.

Em 2026-08-10, este cenário foi testado de ponta a ponta: o bloqueio automático gerado antes
da criação da regra de encaminhamento foi removido, e os dois e-mails foram entregues.

## Incidente conhecido: `NEXT_PUBLIC_SITE_URL` desalinhado (2026-08-12)

A variável `NEXT_PUBLIC_SITE_URL` em Production estava a apontar para o domínio de preview
da Vercel (`lumenva-website-*.vercel.app`) em vez de `https://lumenva.pt`. Isto propagava-se
para `canonical`, `og:url` e todo o JSON-LD (Organization/BreadcrumbList) em cada página —
o domínio público ficava a declarar-se a si mesmo como não-canónico.

Sintoma para detetar isto no futuro: `curl -s https://lumenva.pt/<qualquer-rota> | grep
canonical` deve devolver sempre `lumenva.pt`, nunca um domínio `*.vercel.app`. Corrigido via
`vercel env rm/add NEXT_PUBLIC_SITE_URL production` seguido de novo deploy `--prod`. Confirme
sempre este valor depois de qualquer redeploy manual ou mudança de projeto na Vercel.
