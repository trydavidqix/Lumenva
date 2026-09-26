# Runbook — n8n standalone self-host stack (AI Platform Fase 6, Task 5)

> Stack **opcional** e **operacionalmente separada** do core do DeskcommCRM
> (`docker-compose.prod.yml`). Não entra na cadeia de dependência de
> `app`/`worker`/`waha`/`scheduler`; sobe/desce/atualiza de forma
> independente. Arquivos: `infra/deployment/n8n/docker-compose.yml`,
> `infra/deployment/n8n/.env.example`.

## Escopo e limites

- O n8n desta stack usa um **PostgreSQL próprio** (`n8n-postgres`), nunca o
  Postgres/Supabase do CRM.
- Nenhum env de service-role/CRM é injetado neste compose. A única fronteira
  entre n8n e o CRM é a API pública já existente, autenticada por
  credenciais provisionadas explicitamente:
  - `n8n -> CRM`: MCP (`POST /api/mcp`, bearer `dsk_...` de `api_tokens`) —
    provisionamento e escopos em `docs/runbooks/n8n-token.md`; ou o webhook
    genérico de captação de lead (`POST /api/v1/webhooks/in/<token>`,
    `webhook_sources`, HMAC opcional via `x-deskcomm-signature`,
    `app/api/v1/webhooks/in/[token]/route.ts`).
  - `CRM -> n8n`: ação de automação `n8n_webhook`
    (`lib/automation/actions/n8n-webhook.ts`), que assina o corpo com o
    segredo configurado na regra (`secret`/`secret_enc`) e envia o
    `N8nIntegrationEnvelope` canônico (`lib/automation/n8n/envelope.ts`) —
    sanitizado contra vazamento de segredo antes do envio.
- Subir este compose **não liga** nenhuma automação: as regras de automação
  que usam a ação `n8n_webhook` são configuradas/ativadas separadamente pelo
  operador, e o feature flag `n8n` (`ai_platform_feature_flags`) governa o
  rollout dessa superfície no lado CRM.

## Imagem pinada

`n8nio/n8n:2.34.6` — tag exata (não `latest`/`stable`), re-verificada contra
`github.com/n8n-io/n8n/releases` em 2026-08-16 (release estável mais recente
naquela data, publicada 2026-08-14). Cada upgrade de tag é uma mudança
explícita e revisada (seção Update abaixo), nunca um pull silencioso.

`postgres:16-alpine` — major/tag exato dedicado ao n8n. Considere pinar por
digest antes de ir a produção (`docker pull ... && docker inspect ... --format
'{{.RepoDigests}}'`), mesmo cuidado descrito em
`docs/runbooks/waha-hostgator.md` §5.1.

## Subir

```bash
cp infra/deployment/n8n/.env.example infra/deployment/n8n/.env
# preencha infra/deployment/n8n/.env com valores REAIS do cofre operacional gerido
# (docs/runbooks/ai-platform-secrets.md) — nunca use os placeholders em produção.
chmod 600 infra/deployment/n8n/.env

docker compose -f infra/deployment/n8n/docker-compose.yml --env-file infra/deployment/n8n/.env config   # valida antes de subir
docker compose -f infra/deployment/n8n/docker-compose.yml --env-file infra/deployment/n8n/.env up -d
docker compose -f infra/deployment/n8n/docker-compose.yml --env-file infra/deployment/n8n/.env ps
docker compose -f infra/deployment/n8n/docker-compose.yml logs -f n8n   # confere boot limpo
```

Sem `infra/deployment/n8n/.env` preenchido, o `config`/`up` falha alto e explícito nas
variáveis obrigatórias (`N8N_DB_PASSWORD`, `N8N_ENCRYPTION_KEY`, `N8N_HOST`,
`N8N_WEBHOOK_URL`) — nunca sobe com um segredo vazio/adivinhado.

## Gerando os segredos

```bash
# senha do Postgres dedicado ao n8n
openssl rand -base64 32

# N8N_ENCRYPTION_KEY — ver aviso crítico na próxima seção antes de gerar
openssl rand -hex 32
```

Guarde os dois no cofre operacional gerido (Infisical, conforme
`docs/runbooks/ai-platform-secrets.md`). Nunca em `infra/deployment/n8n/.env` commitado,
log, ticket, screenshot ou fixture de teste.

## `N8N_ENCRYPTION_KEY` — o valor mais crítico desta stack

Esta chave cifra, at-rest no `n8n-postgres`, toda credencial e todo dado de
execução salvo no n8n (tokens de API de terceiros, credenciais HTTP Header
Auth incluindo o bearer `dsk_...` do CRM, segredos de webhook, etc.).

- **Perder esta chave é perder acesso a todas as credenciais armazenadas no
  n8n** — não há recuperação. O n8n continua rodando, mas cada credencial
  cifrada com a chave antiga fica ilegível.
- **Nunca regenere/rotacione esta chave sobre um volume/banco já
  populado.** Trocar `N8N_ENCRYPTION_KEY` sem migrar as credenciais
  primeiro deixa toda credencial existente inutilizável — o único caminho
  seguro é recriar manualmente cada credencial no n8n (re-autenticação one
  by one) depois da troca, nunca antes.
- Guarde uma cópia desta chave no cofre operacional com o mesmo rigor de um
  segredo mestre — se ela se perder junto com o volume, o wipe é o único
  caminho (seção "Wipe" abaixo), com toda credencial recriada do zero.
- Ao restaurar um backup de `n8n-postgres` (seção Backup), a
  `N8N_ENCRYPTION_KEY` usada no `infra/deployment/n8n/.env` do ambiente de restauração
  **precisa ser exatamente a mesma** que cifrou aquele backup — restaurar o
  banco com uma chave diferente produz o mesmo efeito de perda descrito
  acima.

## Rede e exposição pública

Por padrão, **nenhuma porta é publicada para a internet**. O compose só
publica `127.0.0.1:${N8N_LOOPBACK_PORT:-5678}:5678` (loopback do host) — o
`n8n-postgres` não publica porta nenhuma, nem loopback. Um proxy reverso
do HOST (não um serviço deste compose) decide o que fica público, seguindo o
mesmo padrão externo já usado por WAHA/app em produção (ver
`docs/runbooks/deploy.md` e `docs/runbooks/waha-hostgator.md` §6 —
Traefik-on-host nas hospedagens que já entregam um, ou Nginx/Caddy próprio
quando a VPS é "crua").

**Nunca reaproveite o hostname público do WAHA/app para o n8n.** Use um
hostname dedicado (ex.: `n8n.<domínio>`).

### Opção A (padrão recomendado) — nada público

Não crie nenhuma entrada de proxy/DNS para o n8n. Acesse o editor só por
túnel SSH quando precisar:

```bash
ssh -L 5678:127.0.0.1:5678 usuario@vps
# abra http://127.0.0.1:5678 no browser local
```

Cobre o caso comum de workflows disparados por cron/manual/polling que não
precisam receber webhook público nenhum.

### Opção B — só webhooks públicos, editor continua só por túnel

Se algum workflow precisa de um Webhook node acionado por um serviço
externo, exponha **só** os paths de webhook do n8n, nunca o editor/API REST,
no hostname dedicado. Exemplo Nginx (mesmo esqueleto de
`docs/runbooks/waha-hostgator.md` §6, adaptado):

```nginx
server {
    listen 443 ssl http2;
    server_name n8n.example.com;

    ssl_certificate     /etc/letsencrypt/live/n8n.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/n8n.example.com/privkey.pem;

    # Só os paths de webhook do n8n ficam públicos.
    location ~ ^/(webhook|webhook-waiting|webhook-test)/ {
        proxy_pass http://127.0.0.1:5678;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Editor, REST e o resto: bloqueado. Continua só acessível por túnel SSH
    # em 127.0.0.1:5678 (Opção A).
    location / {
        return 403;
    }
}

server {
    listen 80;
    server_name n8n.example.com;
    return 301 https://$host$request_uri;
}
```

Se a VPS já roda um Traefik do provedor (Hostinger/Coolify/Dokploy — ver
`docs/runbooks/deploy.md` e o cabeçalho de `docker-compose.traefik.yml`),
reproduza a mesma regra por label/router do Traefik-on-host, restringindo o
router ao `PathPrefix` de webhook, sem tocar no compose deste stack.

### Opção C (avançada, raramente necessária) — editor também público

Só se um operador realmente precisa editar workflows remotamente sem túnel.
Use um **segundo hostname dedicado**, nunca o mesmo do webhook (Opção B) nem
o do WAHA/app, e empilhe uma camada de acesso ALÉM do login do próprio n8n —
por exemplo allowlist de IP ou basic auth no proxy do host, exatamente como
o Caddyfile do CRM bloqueia por padrão o webhook global do WAHA
(`respond @waha_global 403`) até que o operador decida abrir uma exceção
explícita. O login do n8n (criação de owner na primeira execução,
`N8N_USER_MANAGEMENT_DISABLED` **nunca** setado como `true` em produção)
continua sendo a segunda camada, não a única.

### `N8N_PROXY_HOPS`

Sempre que o n8n estiver atrás de qualquer proxy reverso (Opção B ou C),
`N8N_PROXY_HOPS` precisa refletir o número de saltos de proxy até o n8n
(`1` para um único proxy no host — default deste compose). Um valor errado
quebra `N8N_SECURE_COOKIE`/detecção de IP de origem atrás do proxy.

## `n8n audit` — auditoria de segurança

Rode periodicamente (e sempre antes de promover uma instância de piloto
para uso real):

```bash
docker compose -f infra/deployment/n8n/docker-compose.yml exec n8n n8n audit
```

Cobre credenciais desprotegidas, nodes desatualizados, webhooks sem
autenticação e outros achados conhecidos do próprio n8n. Trate qualquer
achado como item a corrigir antes do go-live, não como ruído.

## Backup

O `n8n-postgres` contém **tudo que importa**: workflows, credenciais
cifradas (com `N8N_ENCRYPTION_KEY`), histórico de execuções. Faça backup
antes de qualquer update de imagem e em rotina programada:

```bash
docker compose -f infra/deployment/n8n/docker-compose.yml exec -T n8n-postgres \
  pg_dump -U "$N8N_DB_USER" -d "$N8N_DB_NAME" > n8n-$(date +%F).sql
```

Guarde o dump cifrado, fora do host, com acesso restrito — ele contém
credenciais cifradas, não texto claro, mas ainda é material sensível
(vazamento facilita ataque offline à cifra se a chave também vazar).

Guarde também, **junto** com o histórico de backups (mesmo cofre, não o
mesmo arquivo), a `N8N_ENCRYPTION_KEY` que cifrou aquele dump específico —
sem ela o dump é inútil (ver seção anterior).

O volume `n8n-data` (`/home/node/.n8n`) guarda config local; inclua-o no
backup se o operador tiver customizado algo além do que vive no banco.

## Restore

```bash
docker compose -f infra/deployment/n8n/docker-compose.yml stop n8n
docker compose -f infra/deployment/n8n/docker-compose.yml exec -T n8n-postgres \
  psql -U "$N8N_DB_USER" -d "$N8N_DB_NAME" < n8n-YYYY-MM-DD.sql
# infra/deployment/n8n/.env deste ambiente precisa ter a MESMA N8N_ENCRYPTION_KEY
# que cifrou o dump restaurado — ver aviso na seção anterior.
docker compose -f infra/deployment/n8n/docker-compose.yml start n8n
docker compose -f infra/deployment/n8n/docker-compose.yml exec n8n n8n audit
```

Teste esta sequência periodicamente num ambiente descartável — backup nunca
testado não é backup confiável (mesma doutrina de
`docs/runbooks/waha-hostgator.md` §7.3).

## Update (upgrade de versão)

1. Backup completo (`pg_dump` + confirmação de que a `N8N_ENCRYPTION_KEY`
   atual está no cofre) antes de tocar na imagem.
2. Confira o changelog/release notes oficiais da tag alvo em
   `github.com/n8n-io/n8n/releases` — em particular mudanças de schema/
   variáveis de ambiente obrigatórias novas (por exemplo, versões recentes
   do n8n vêm migrando execução de nodes de Code para *Task Runners*
   externos; confirme nas release notes da tag alvo se alguma variável tipo
   `N8N_RUNNERS_ENABLED` passou a ser exigida antes de trocar a tag em
   produção — este runbook não assume esse comportamento por não ter sido
   verificado ao vivo contra `2.34.6`).
3. Edite `image: n8nio/n8n:<nova-tag>` em `infra/deployment/n8n/docker-compose.yml`
   (PR revisado, nunca edição direta em produção).
4. Suba primeiro num ambiente de teste com uma cópia do backup, rode
   `n8n audit` e um smoke test dos workflows críticos.
5. Em produção:

   ```bash
   docker compose -f infra/deployment/n8n/docker-compose.yml pull n8n
   docker compose -f infra/deployment/n8n/docker-compose.yml up -d n8n
   docker compose -f infra/deployment/n8n/docker-compose.yml logs -f n8n
   ```

   O n8n roda suas próprias migrations de banco automaticamente no boot.

## Rollback

O n8n **não suporta downgrade de schema**: depois que uma versão nova rodou
suas migrations sobre `n8n-postgres`, voltar a imagem para uma tag antiga
não reverte o banco. Rollback seguro é:

1. Parar o n8n (`docker compose -f infra/deployment/n8n/docker-compose.yml stop n8n`).
2. Restaurar o `pg_dump` feito ANTES do update (seção Restore) — isso
   também reverte o schema.
3. Voltar `image:` para a tag pinada anterior.
4. Subir e validar (`n8n audit` + smoke test) antes de liberar de novo.

Nunca tente "voltar a tag e seguir usando o banco já migrado" — isso é
comportamento não suportado pelo próprio n8n e pode corromper dados.

## Desconectar completamente o CRM (contenção/desativação)

Quando for preciso cortar toda comunicação entre esta instância n8n e o CRM
(instância comprometida, piloto encerrado, workflow suspeito):

1. **Kill switch imediato do lado CRM** (não depende de nada no n8n):
   `AI_PLATFORM_KILL_N8N=true` no runtime do CRM força a feature `n8n`
   (`ai_platform_feature_flags`) para `off` globalmente, sobrepondo
   qualquer `mode` salvo por tenant (`lib/agent-engine/platform/features.ts`,
   doutrina em `docs/runbooks/ai-platform-secrets.md`).
2. **Revogar todo token MCP** (`n8n -> CRM`): `/app/settings/api-tokens`
   (role `admin`) → **Revogar** em cada token criado para este n8n, ou
   `POST /api/v1/settings/api-tokens/{id}/revoke` (idempotente). Depois de
   revogado, `validateBearerToken` rejeita com `401` mesmo sem expiração
   configurada — ver `docs/runbooks/n8n-token.md`.
3. **Desativar toda fonte de webhook genérica** (`n8n -> CRM` via
   `/api/v1/webhooks/in/<token>`, se usada): `PATCH
   /api/v1/webhook-sources/{id}` com `is_active: false`, ou `DELETE
   /api/v1/webhook-sources/{id}` se a fonte não tiver mais uso.
4. **Desativar/remover toda regra de automação `n8n_webhook`**
   (`CRM -> n8n`): `PATCH /api/v1/automation-rules/{id}` com
   `is_active: false` (para de disparar sem apagar a config) ou `DELETE
   /api/v1/automation-rules/{id}`. Isso impede o CRM de continuar chamando
   a URL de webhook daquele n8n, mesmo que o segredo ainda seja válido.
5. **No lado n8n**: desative/apague a credencial HTTP Header Auth que guarda
   o bearer `dsk_...`, e desative os workflows que a usam. Se a instância
   inteira foi comprometida, trate-a como perdida: gere uma instância nova
   (nova `N8N_ENCRYPTION_KEY`, novo Postgres) em vez de tentar limpar a
   antiga.
6. Confirme em `api_audit_log` (`action: "token.revoked"` /
   `"mcp.tool_called"`) que as chamadas pararam.

## Wipe completo (raro)

Só após aprovação explícita e confirmação visual do volume exato (nunca
`docker compose down -v`, que pode remover volume não relacionado):

```bash
docker compose -f infra/deployment/n8n/docker-compose.yml stop n8n n8n-postgres
docker volume ls --format '{{.Name}}' | grep n8n
# confirme visualmente os nomes exatos acima antes de remover
docker volume rm <nome-exato-n8n-postgres-data> <nome-exato-n8n-data>
```

Isso apaga workflows, credenciais e histórico de execução do n8n
permanentemente. Não afeta nenhum dado do CRM — os dois bancos são
totalmente independentes.

## Referências

- `infra/deployment/n8n/docker-compose.yml`, `infra/deployment/n8n/.env.example` — esta stack.
- `docs/runbooks/n8n-token.md` — provisionamento least-privilege do token
  MCP usado por workflows n8n (`n8n -> CRM`).
- `docs/runbooks/ai-platform-secrets.md` — cofre operacional, kill
  switches, break-glass.
- `docs/runbooks/deploy.md`, `docs/runbooks/waha-hostgator.md` — padrão de
  proxy reverso externo já usado em produção neste repo.
- `lib/automation/actions/n8n-webhook.ts`,
  `lib/automation/n8n/envelope.ts` — ação `CRM -> n8n`.
- `app/api/v1/webhooks/in/[token]/route.ts` — webhook genérico
  `n8n -> CRM` (captação de lead).
- `lib/agent-engine/platform/features.ts` — feature flag/kill switch
  `n8n` do lado CRM.
