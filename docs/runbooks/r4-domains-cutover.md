# R4 — cutover de domínios (preparação)

Não executado. Requer janela e aprovação do dono. Domínios alvo: `app.lumenva.pt` e `lumenva.pt`; manter `deskcomm.*` com redirect 301 durante a compatibilidade.

## Ordem humana

1. Baixar TTL DNS dos quatro nomes para 300 segundos e aguardar o TTL anterior.
2. Adicionar hosts novos a allowed-hosts e CORS; manter `deskcomm.*` explicitamente.
3. Adicionar callbacks OAuth dos hosts novos, mantendo os antigos.
4. Atualizar URLs de webhook WAHA, mantendo o endpoint antigo assinado durante a janela.
5. Adicionar sites/routers Caddy ou Traefik para os hosts novos; não remover o proxy antigo.
6. Aceitar cookie domain `.lumenva.pt`; manter cookie antigo até expiração controlada.
7. Atualizar remetente, links e callbacks de e-mail, mantendo compatibilidade antiga.
8. Alterar DNS e só então ativar `LUMENVA_CANONICAL_HOST` (permanece OFF nesta preparação).

## Verificação e rollback

Em staging/local: login OAuth mock, webhook WAHA HMAC válido e inválido, preflight CORS, cookie Secure/HttpOnly/Domain, e-mail sandbox e 301 dos hosts deskcomm. Usar `scripts/cutover/r4-domains-dry-run.sh`.

Rollback: desligar `LUMENVA_CANONICAL_HOST`, reverter DNS, manter allowlist/callbacks/webhooks/cookies/e-mails antigos. Não remover certificados, aliases ou registros antigos durante a janela.
