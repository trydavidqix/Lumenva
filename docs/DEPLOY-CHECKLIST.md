# Deploy Preflight Checklist

> Estado atual da instalação Lumenva: o rename PT/UE, o cutover Docker e as sete
> flags RGPD já foram executados em produção. Este checklist continua sendo um
> preflight reutilizável para futuros deploys; não é uma indicação de que o
> cutover esteja pendente.

Run through this list before promoting to production (or before each release tag).

Current release line: `main @ ed70187c`, único branch de integração; `origin/main`
e VPS devem estar no mesmo SHA. O runtime dos seis agentes de produção usa
provider direto OpenAI `gpt-5.6-terra` via credencial BYOK. AI Gateway e
OpenRouter não estão ativos na produção; Anthropic é fallback.

## Environment

- [ ] All envs set in Vercel project (mirror `.env.local`)
- [ ] `SENTRY_DSN` set; `SENTRY_AUTH_TOKEN` configured for source maps upload
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] `WAHA_*` envs set (URL, plaintext API key client side, SHA512 hash server side)
- [ ] `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` set
- [ ] `INTERNAL_SECRET` set (rotated at least once)

## Infrastructure

- [ ] Supabase migrations applied to target environment (`supabase/migrations/`)
- [ ] Supabase RLS policies verified on tenant-aware tables (cross-tenant smoke)
- [ ] WAHA Plus running with auth'd WhatsApp number, webhook URL pointing to deploy
- [ ] Sentry project configured + DSN in env, test event captured
- [ ] Resend domain verified (transactional emails)
- [ ] Nuvemshop app published in Partners portal

## Verification

- [ ] `pnpm typecheck` clean locally on the release commit
- [ ] `pnpm lint` clean
- [ ] `pnpm test:unit` green
- [ ] `pnpm test:e2e` green against preview URL
- [ ] Manual smoke: login (with MFA), create lead, send/receive WhatsApp message, see audit log entry, view kanban
- [ ] Sentry test event captured from prod environment
- [ ] LCP/CLS/INP within budget (Vercel Analytics RUM)
- [ ] No `console.log` leaks in build output (`pnpm build | grep -i console` should be quiet)

## Rollback plan

- [ ] Previous deploy URL noted
- [ ] DB migrations reversible OR forward-only with documented hot-fix path
- [ ] On-call engineer notified

---

Reference: [`docs/stories/epics/EPIC-12-hardening.md`](stories/epics/EPIC-12-hardening.md) §S-12.10.
