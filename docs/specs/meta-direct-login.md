# Meta Direct Social Login — Documentação Operacional

> Última atualização: 2026-09-21  
> Branch: `feat/meta-direct-social-login`  
> Versão Graph API: **v22.0**

---

## Visão Geral

O Lumenva Social Brain suporta conexão nativa com **Instagram** e **Facebook** sem depender do BrightBean.
O fluxo OAuth completo é gerenciado pelo próprio Lumenva: o usuário clica → autoriza → volta conectado.

**BrightBean** permanece ativo apenas para **TikTok** e **YouTube**.

```
Lumenva Social Brain
        │
        ├── ProviderRouter
        │
        ├── MetaProvider          ← Instagram, Facebook
        │     ├── Instagram OAuth
        │     ├── Facebook OAuth
        │     ├── Publicação (imagem, carrossel, vídeo/reel)
        │     ├── Analytics (conta + post)
        │     ├── Comentários + DM
        │     └── Token Lifecycle (refresh automático)
        │
        └── BrightBeanProvider    ← TikTok, YouTube
```

---

## Variáveis de Ambiente Necessárias

Copie `.env.example` para `.env.local` e preencha:

| Variável | Descrição |
|---|---|
| `META_APP_ID` | ID do App Meta (developers.facebook.com) |
| `META_APP_SECRET` | Segredo do App Meta |
| `META_REDIRECT_BASE_URL` | URL base para callbacks OAuth (sem barra final) |
| `META_WEBHOOK_VERIFY_TOKEN` | Token de verificação do webhook |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | Chave hex 32 bytes para criptografar tokens no banco |
| `BRIGHTBEAN_BASE_URL` | Opcional — só necessário para TikTok/YouTube |
| `BRIGHTBEAN_API_KEY` | Opcional — só necessário para TikTok/YouTube |

### Gerar `SOCIAL_TOKEN_ENCRYPTION_KEY`
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Fluxo OAuth

### Instagram
```
GET  /api/integrations/meta/instagram/start    → redirect para Meta OAuth
GET  /api/integrations/meta/instagram/callback → troca code por token → salva → redirect /social-accounts
POST /api/integrations/meta/instagram/disconnect
POST /api/integrations/meta/instagram/reconnect
```

### Facebook
```
GET  /api/integrations/meta/facebook/start    → redirect para Meta OAuth
GET  /api/integrations/meta/facebook/callback → lista Pages → salva → redirect /social-accounts
POST /api/integrations/meta/facebook/disconnect
POST /api/integrations/meta/facebook/reconnect
```

---

## Configurar o App Meta (developers.facebook.com)

1. Acesse [developers.facebook.com](https://developers.facebook.com) → Seu app "Lumenva Content OS"
2. **Facebook Login** → Configurações OAuth → adicionar Redirect URI:
   ```
   {META_REDIRECT_BASE_URL}/api/integrations/meta/facebook/callback
   ```
3. **Instagram** → Configurações → adicionar Redirect URI:
   ```
   {META_REDIRECT_BASE_URL}/api/integrations/meta/instagram/callback
   ```
4. **Webhooks** → configurar:
   - **Callback URL:** `{SEU_DOMINIO}/api/webhooks/meta`
   - **Verify Token:** valor do `META_WEBHOOK_VERIFY_TOKEN`
   - **Campos:** `comments`, `messages`, `reactions`

---

## Token Lifecycle

Os tokens são renovados automaticamente pelo worker `social.connection.refresh`.

- Tokens Instagram são renovados via endpoint `/refresh_access_token` da Graph API.
- Tokens de Página do Facebook são Long-Lived e não expiram nativamente.
- Se a renovação falhar, o status da conexão é marcado como `reconnect_required` e o usuário vê um alerta na UI para reconectar com um clique.

---

## Segurança

| Requisito | Status |
|---|---|
| OAuth state anti-CSRF | ✅ |
| Server-side token exchange | ✅ |
| Tokens criptografados no banco | ✅ |
| Nenhum token em logs ou client-side | ✅ |
| Webhook signature validation (HMAC-SHA256) | ✅ |
| Deduplicação de eventos | ✅ |
| RLS no banco | ✅ (tabela social_connections) |
| Secrets apenas via env/Secret Manager | ✅ |

---

## Publicação

| Formato | Instagram | Facebook |
|---|---|---|
| Texto puro | ❌ | ✅ |
| Imagem única | ✅ | ✅ |
| Carrossel | ✅ | ✅ |
| Vídeo/Reel | ✅ (async) | ✅ |

Reels e vídeos são publicados de forma **assíncrona** — o job é marcado como `reconcile_required` e o worker confirma a publicação após a Meta terminar de processar.

---

## Rollback

BrightBean continua ativo como fallback. Para reverter Instagram/Facebook para BrightBean:
1. Remova a variável `META_APP_ID` do ambiente.
2. O `ProviderRouter` deixará de registrar o `MetaProvider`.
3. O BrightBean assumirá todas as redes (se configurado).

---

## Desenvolvimento Local

```bash
# Instalar dependências
pnpm install

# Iniciar Social Brain Web
pnpm --filter "@lumenva/web" dev

# Rodar testes do pacote Meta
cd packages/integrations/meta && pnpm test

# Typecheck do monorepo
pnpm typecheck
```

---

## Eventos de Auditoria

Os seguintes eventos são registrados no sistema de auditoria:

- `social.connection.started`
- `social.connection.connected`
- `social.connection.reconnected`
- `social.connection.disconnected`
- `social.token.refreshed`
- `social.token.refresh_failed`
- `social.webhook.received`
- `social.publication.requested`
- `social.publication.published`
- `social.publication.failed`
