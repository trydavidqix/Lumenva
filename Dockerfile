# syntax=docker/dockerfile:1
# Lumenva — imagem genérica para Next.js no monorepo (Cloud Run).
# Build: docker build --build-arg APP_NAME=website -t lumenva-website .

# ---- deps: instala dependências (layer cacheável) ----
FROM node:22.23.3-alpine AS deps
WORKDIR /app
RUN corepack enable

# Para cachear o install num monorepo, precisamos dos manifestos.
# Usamos apenas os arquivos necessários para o pnpm install.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Copia apenas os package.json dos pacotes (o Dockerfile real pode precisar de ferramentas externas, 
# mas pnpm fetch/install --offline é ideal. Aqui faremos o simples: copia tudo).
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm repo:check

# ---- build: gera .next/standalone ----
FROM node:22.23.3-alpine AS build
ARG APP_NAME=crm
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=4096

RUN pnpm --filter ${APP_NAME} build

# ---- runner: imagem slim de produção ----
FROM node:22.23.3-alpine AS runner
ARG APP_NAME=crm
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Dependências adicionais
RUN apk add --no-cache ffmpeg

# non-root
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# O Next.js standalone num monorepo gera a saída em apps/${APP_NAME}/.next/standalone
COPY --from=build --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/standalone ./
# O standalone também copia node_modules pro raiz, então a estrutura final do container terá:
# /app/apps/${APP_NAME}/server.js

# Os assets estáticos não vão para o standalone, precisam ser copiados explicitamente.
COPY --from=build --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/${APP_NAME}/public ./apps/${APP_NAME}/public

USER nextjs
EXPOSE 8080

# O entrypoint é gerado no diretório da app pelo standalone.
ENV APP_PATH=apps/${APP_NAME}/server.js
CMD node $APP_PATH

