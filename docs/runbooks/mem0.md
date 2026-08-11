# Mem0 OSS: operação do sidecar opcional

## Limites e estado seguro

O Mem0 é uma projeção semântica descartável, nunca a fonte de verdade do CRM.
As fontes oficiais continuam no PostgreSQL do CRM (mensagens, `lead_notes`,
`org_memory` e eventos). O perfil `ai-memory` vem desligado: `docker compose
up -d` não o inicia. Configurar ou iniciar o serviço não liga a funcionalidade
do produto; a feature por organização permanece `off` até uma decisão explícita
de rollout para `shadow`.

Não publique a API, o dashboard ou o banco por Caddy. Em desenvolvimento a API
pode ser aberta apenas em `127.0.0.1:8888`; em produção não há porta publicada.
O nome DNS interno é `mem0` e só serviços na rede Docker interna podem alcançá-lo.

A imagem do servidor está deliberadamente pinada em
`mem0/mem0-api-server:0.1.117`; `latest` não é aceitável porque pode mudar sem
revisão. Uma atualização exige alteração versionada, revisão e a validação do
perfil no Windows antes de promoção. O pin é uma referência de release, não um
digest imutável: confirme disponibilidade e release notes no Windows antes de
alterá-lo.

Este runbook é para a máquina Windows com Docker já autorizado. Não instalar,
executar ou pedir Docker no Mac.

## Segredos antes do bootstrap

Guarde estes valores somente no runtime gerido (Infisical, conforme
`docs/runbooks/ai-platform-secrets.md`); nunca em Git, tickets, logs ou
`.env.example`:

```text
MEM0_POSTGRES_PASSWORD=<senha longa e exclusiva do banco Mem0>
MEM0_JWT_SECRET=<saída de openssl rand -base64 48>
MEM0_OPENAI_API_KEY=<chave do provider escolhida para o servidor Mem0>
MEM0_API_KEY=<chave m0sk_ emitida após o bootstrap>
MEM0_BASE_URL=http://mem0:8000
MEM0_TIMEOUT_MS=2000
```

`MEM0_OPENAI_API_KEY` é exigida pelo servidor OSS para embeddings/configuração;
não configure uma chave, conta ou provider como parte desta alteração. Antes do
bootstrap, aprove custos, retenção e a chave a usar. `AUTH_DISABLED=true` é
proibido em produção.

## Iniciar e validar no Windows

Desenvolvimento (a porta é apenas loopback):

```bash
docker compose --profile ai-memory up -d mem0-postgres mem0
curl --fail http://127.0.0.1:8888/auth/setup-status
docker compose --profile ai-memory ps
```

Produção self-hosted (sem porta pública):

```bash
docker compose -f docker-compose.prod.yml --env-file .env --profile ai-memory up -d mem0-postgres mem0
docker compose -f docker-compose.prod.yml --profile ai-memory ps
docker compose -f docker-compose.prod.yml logs --tail=100 mem0
```

Antes de subir, valide o YAML no Windows:

```bash
docker compose config
docker compose -f docker-compose.prod.yml config
```

O estado `healthy` do serviço e `GET /auth/setup-status` são a prova mínima de
que o servidor iniciou. Não habilite a feature do CRM nesta etapa.

## Primeiro administrador e chave de aplicação

Com a API local temporária, complete o único registo administrativo pelo
endpoint `/auth/register` ou pelo assistente oficial do Mem0. Depois faça login
e crie uma chave por `POST /api-keys`; o valor `m0sk_...` é mostrado só uma vez.
Armazene-o como `MEM0_API_KEY` no gestor de segredos e revogue-o no Mem0 se for
exposto. Não use a chave administrativa legada como credencial da aplicação.

Após o bootstrap, remova qualquer mapeamento de porta local que deixe de ser
necessário. Produção deve continuar sem `ports:` no serviço `mem0`.

## Backup, parar e recuperação

Faça um dump consistente do banco dedicado antes de atualizar a imagem ou
alterar a configuração do servidor:

```bash
docker compose --profile ai-memory exec -T mem0-postgres pg_dump -U mem0 -d mem0 > mem0-$(date +%F).sql
```

Guarde o backup cifrado fora do host, com acesso restrito. Para desativar sem
apagar dados: mantenha a feature Mem0 em `off`, defina
`AI_PLATFORM_KILL_MEM0=true` se for uma contenção imediata e pare somente os
serviços do perfil. Não apague o volume durante uma contenção.

```bash
docker compose --profile ai-memory stop mem0 mem0-postgres
```

## Wipe e reconstrução completos

Uma limpeza remove memórias, chaves de API, utilizadores e auditoria do Mem0.
Só faça isso após aprovação explícita e depois de confirmar que o nome do volume
é o volume exclusivo `mem0-postgres-data` listado pelo Compose. Não use
`docker compose down -v`, pois ele pode remover volumes não relacionados.

```bash
docker compose --profile ai-memory stop mem0 mem0-postgres
docker volume ls --format '{{.Name}}' | findstr mem0-postgres-data
# Após confirmar visualmente o volume exclusivo acima:
docker volume rm <nome-exato-do-volume-mem0-postgres-data>
```

Recriar o sidecar não recria dados do CRM. A reconstrução a partir de fontes
oficiais será feita apenas pelo tooling de ciclo de vida da Fase 2; até então,
não importe mensagens livremente nem trate o Mem0 como arquivo oficial.
