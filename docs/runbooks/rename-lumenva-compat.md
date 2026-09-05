# Compatibilidade do rename Lumenva

Data: 2026-09-05

Durante a janela de compatibilidade, o produto usa os nomes Lumenva como
canônicos e mantém os nomes Deskcomm antigos para não invalidar integrações e
sessões existentes.

## Headers HTTP

- Entrada: `x-lumenva-signature` tem precedência; `x-deskcomm-signature` é
  aceito como fallback.
- Saída de webhooks: `X-Lumenva-Signature` e `X-Deskcomm-Signature` são emitidos
  com a mesma assinatura; os headers de evento `X-Lumenva-Event` e
  `X-Deskcomm-Event` também são emitidos em paralelo.

## Cookies

- O cookie novo de impersonação é `lumenva-impersonate`.
- `deskcomm-impersonate` continua válido para sessões existentes; quando ambos
  existem, o novo tem precedência.
- A sessão Supabase passa a usar `sb-lumenva-auth`; o servidor ainda lê
  `sb-deskcomm-auth` e normaliza os seus chunks para leitura pelo cliente.
- Ao terminar a impersonação, os cookies novo e legado são removidos.
- Domínio, path, `SameSite`, `Secure`, `HttpOnly` e TTL permanecem compatíveis.

## Prazo

Os nomes antigos permanecem aceitos por aproximadamente 90 dias (duas releases
estáveis). A remoção futura exige nova decisão e verificação dos consumidores
externos antes de retirar qualquer leitura ou emissão legada.
