# syntax=docker/dockerfile:1
# DeskcommCRM — imagem de produção self-host (Next.js standalone).
# Build: docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=... -t deskcomm-app .

# ---- deps: instala dependências (layer cacheável) ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build: gera .next/standalone ----
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# IMAGEM GENÉRICA: os NEXT_PUBLIC_* recebem placeholders no build. Os valores
# REAIS do usuário são injetados em RUNTIME — no browser via <PublicEnvScript/>
# (window.__PUBLIC_ENV__) e no servidor via lib/env.ts (parseia process.env em
# runtime). Assim UMA imagem serve qualquer projeto Supabase, sem rebuild.
# (Segredos de runtime NUNCA entram no build — guarda de fase em lib/env.ts.)
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
ARG NEXT_PUBLIC_APP_URL=https://placeholder.invalid
ARG NEXT_PUBLIC_ADMIN_URL=https://placeholder.invalid
# O build do Next (webpack + Sentry) é faminto: o heap default do Node (~2GB)
# estoura. NODE_OPTIONS eleva pra 4GB → requer VPS com >=4GB RAM (ou swap).
# O install.sh checa RAM/swap antes de buildar.
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=4096

# `pnpm build` roda `test:unit` ANTES de `next build`. lib/env.ts só afrouxa a
# validação de segredos quando NEXT_PHASE=phase-production-build — flag que só
# existe DENTRO do `next build`, não durante o `test:unit` que roda antes dele.
# Com NODE_ENV=production já setado (acima), toda var marcada `required()` em
# lib/env.ts é exigida com valor real nesse instante — e nenhuma delas tem
# placeholder aqui, então build local sempre quebrava com 430+ suítes falhando
# na importação (nunca visto antes: deploy sempre puxou imagem pronta do GHCR;
# build local Docker é o caminho "avançado", nunca exercitado até hoje).
# Mesmo padrão de placeholder-só-no-build dos NEXT_PUBLIC_* acima: puro ENV (sem
# ARG — não expor esses nomes como flag de build evita a tentação de passar um
# segredo real por --build-arg, que ficaria gravado na história da camada). O
# valor REAL de produção sempre vence em runtime via `env_file: .env` do compose.
ENV INTERNAL_SECRET=build-placeholder-internal-secret \
    CPF_ENCRYPTION_KEY=build-placeholder-cpf-encryption-key \
    WAHA_BYO_ENCRYPTION_KEY=build-placeholder-waha-byo-encryption-key \
    AI_CRED_AES_KEY=build-placeholder-ai-cred-aes-key \
    SUPABASE_DB_URL=postgresql://placeholder:placeholder@db.placeholder.invalid:5432/placeholder \
    WAHA_API_BASE_URL=https://waha.placeholder.invalid \
    WAHA_API_KEY=build-placeholder-waha-api-key \
    WAHA_WEBHOOK_BASE_URL=https://waha-webhook.placeholder.invalid \
    UPSTASH_REDIS_REST_URL=https://redis.placeholder.invalid \
    UPSTASH_REDIS_REST_TOKEN=build-placeholder-upstash-token

# Turbopack (`pnpm build`): ~4min vs ~34min do webpack num VPS. O bloco `webpack:`
# do Sentry (tree-shake + upload de sourcemap em build-time) é ignorado, mas o
# Sentry RUNTIME segue ativo (DSN hardcoded nas configs). Sourcemap upload é
# concern só da Vercel; aqui o ganho de tempo de build é o que importa pro leigo.
RUN pnpm build

# ---- runner: imagem slim de produção ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
# ffmpeg: a derivação de vídeo (Onda 3.1) roda no processo do app — o cron
# event-log-drain executa o media_derive handler, que chama `ffmpeg` via spawn
# pra extrair áudio+frames. Sem o binário, todo vídeo recebido falha a derivação.
RUN apk add --no-cache ffmpeg
# non-root
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
# O output standalone NÃO inclui public/ nem .next/static — copiar explicitamente,
# senão CSS/JS/assets retornam 404 (app "sem estilo").
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
# server.js é o entrypoint gerado pelo output standalone.
CMD ["node", "server.js"]
