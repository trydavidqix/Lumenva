# Lumenva → Google Platform Migration

## Objetivo

Concentrar infraestrutura do Lumenva em Firebase + Google Cloud sem quebrar o produto e sem misturar hosting/runtime com migração de banco na mesma etapa.

## Milestone 1 — Google runtime, Supabase ainda intacto

Objetivo:
- Firebase App Hosting/Cloud Run executam o app;
- GitHub continua fonte de código;
- Supabase atual continua DB/Auth/Realtime/Storage;
- nenhum cutover destrutivo.

Acceptance:
- app sobe em DEV no Google;
- health e fluxos básicos funcionam;
- build/testes relevantes passam;
- secrets ficam fora do repo;
- Vercel continua disponível como rollback até prova de paridade.

## Milestone 2 — serviços periféricos

Migrar progressivamente:
- Vercel Cron → Cloud Scheduler;
- Vercel/infra serverless → App Hosting/Cloud Run;
- Cloudflare DNS → Cloud DNS;
- Cloudflare R2/backup, se ativo → Cloud Storage;
- Upstash Redis → Memorystore quando custo/semântica fizerem sentido;
- Resend → Firebase Auth + Google Workspace/relay para fluxos simples;
- Sentry → Google Observability somente após paridade comprovada.

## Milestone 3 — Supabase

- Supabase Postgres → Cloud SQL PostgreSQL;
- Supabase Auth → Firebase Authentication;
- Supabase Storage → Cloud Storage;
- Supabase Realtime → Firestore/projeções ou mecanismo Google apropriado;
- SQL pesado/RPC continua em Postgres/Cloud Run; não converter 147 tabelas relacionais cegamente para Firestore.

## Invariantes

- sem ação destrutiva no Supabase antes de backup + paridade;
- tenant isolation precisa continuar provado;
- schema/RLS exige teste real;
- produção e custos exigem Owner Gate;
- um único executor principal por task;
- Claude Maestro decide a sequência;
- Codex implementa por default;
- Gemini executa tarefas Google-native;
- Reviewer independente;
- evidence antes de cutover.