# MCP Relay Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose only `relayEmailNotification` through a remote Streamable HTTP MCP endpoint protected by an OAuth 2.1 authorization-code + PKCE flow compatible with ChatGPT Connectors.

**Architecture:** Add a dedicated `/api/mcp/relay` MCP server instead of widening the existing internal MCP catalog. Co-locate a minimal single-user OAuth authorization server in the Next.js app, use Upstash Redis for hashed short-lived authorization codes and access-token sessions, and proxy successful tool calls to the existing internal email relay using `INTERNAL_SECRET` server-side only.

**Tech Stack:** Next.js 16 Route Handlers, TypeScript strict, `@modelcontextprotocol/sdk` 1.30, Zod, Upstash Redis/rate limiter, structured logger/audit, Vitest.

**Spec:** Approved in-chat design (2026-09-03), grounded in `docs/specs/11-spec-mcp-server-internal.md`, `docs/integrations/email-whatsapp-relay.md`, MCP Authorization 2025-11-25, and OpenAI MCP documentation.

## Global Constraints

- Work only in branch `feat/mcp-relay-connector` under `.worktrees/mcp-relay-connector`; do not merge or deploy.
- `INTERNAL_SECRET`, OAuth codes, PKCE values, bearer tokens, cookies, email bodies, and PII never enter logs, tests, screenshots, commits, or documentation.
- OAuth bearer tokens are accepted only in `Authorization` headers, never query strings, and are audience-bound to `https://crm.lumenva.pt/api/mcp/relay`.
- The dedicated MCP exposes exactly one write tool and never accepts destination, organization, or phone-number overrides.
- Reuse the existing relay endpoint and its `message_id` idempotency semantics; do not duplicate WhatsApp delivery logic.
- New production env vars must be represented in `lib/env.ts` and `.env.example` with no secret values.
- Local verification uses `EMAIL_RELAY_DRY_RUN=true` and fictitious payloads; no real WhatsApp send.

### Task 1: OAuth storage and protocol primitives

**Files:**
- Create: `lib/oauth/relay-store.ts`
- Create: `lib/oauth/relay-protocol.ts`
- Modify: `lib/env.ts`
- Modify: `.env.example`
- Test: `tests/unit/mcp-relay-oauth.test.ts`

**Interfaces:**
- `createAuthorizationCode(input): Promise<string>` and `consumeAuthorizationCode(code, verifier, clientId, redirectUri, resource): Promise<RelayOAuthGrant>`.
- `issueAccessToken(grant): Promise<{ accessToken: string; expiresIn: number }>` and `validateAccessToken(token): Promise<RelayAccessGrant | null>`.
- `revokeAccessToken(token): Promise<void>`.
- `verifyPkceS256(verifier, challenge): boolean`.

- [ ] Add env validation for `MCP_RELAY_ENABLED`, `MCP_RELAY_OAUTH_APPROVAL_SECRET`, and optional issuer/audience defaults.
- [ ] Implement opaque random values, SHA-256-at-rest Redis records, TTLs, single-use code consumption, exact client/redirect/resource binding, and token revocation.
- [ ] Add unit tests for PKCE, expiry, single-use, audience mismatch, scope mismatch, and revocation; assert no plaintext secret/token is logged.

### Task 2: Client registration, metadata, authorization, token, and revocation routes

**Files:**
- Create: `app/api/oauth/register/route.ts`
- Create: `app/api/oauth/authorize/route.tsx`
- Create: `app/api/oauth/token/route.ts`
- Create: `app/api/oauth/revoke/route.ts`
- Create: `app/.well-known/oauth-protected-resource/[...resource]/route.ts`
- Create: `app/.well-known/oauth-authorization-server/route.ts`
- Test: `tests/unit/mcp-relay-oauth-routes.test.ts`

**Interfaces:**
- `POST /api/oauth/register` returns a public `client_id` and stores exact redirect URI metadata.
- `GET/POST /api/oauth/authorize` authenticates with the dedicated approval secret and redirects once with an authorization code.
- `POST /api/oauth/token` accepts only `authorization_code`, `code_verifier`, exact `redirect_uri`, and matching resource.
- `POST /api/oauth/revoke` revokes a bearer supplied in the request body.
- Metadata identifies `https://crm.lumenva.pt/api/mcp/relay`, issuer, endpoints, `email:relay`, and `S256`.

- [ ] Validate all OAuth inputs with Zod and reject wildcard/non-HTTPS redirects (except localhost where protocol permits).
- [ ] Render a minimal approval page with client name, requested scope, and explicit approval; never echo the approval secret.
- [ ] Return standards-compatible OAuth errors without revealing token/code state.
- [ ] Add route tests for malformed requests, wrong password, redirect mismatch, PKCE failure, successful exchange, expiry, revocation, and metadata.

### Task 3: Dedicated Streamable HTTP MCP relay server

**Files:**
- Create: `lib/mcp/relay-server.ts`
- Create: `app/api/mcp/relay/route.ts`
- Test: `tests/unit/mcp-relay-server.test.ts`

**Interfaces:**
- `createRelayMcpServer(context): McpServer` registers only `relayEmailNotification`.
- `relayEmailNotification` accepts the existing email notification Zod shape and returns the existing public relay result.

- [ ] Validate the OAuth bearer before creating the MCP transport; return `401` plus `WWW-Authenticate` resource metadata.
- [ ] Enforce `email:relay`, rate limit the connector, and attach a request ID.
- [ ] Proxy to `/api/internal/notifications/email` with server-side `INTERNAL_SECRET`; never pass through the OAuth token.
- [ ] Map upstream status classes to MCP-safe errors and audit success/failure categories without email content.
- [ ] Add tests proving only one tool is listed, auth is mandatory, wrong audience is rejected, dry-run proxy works, and internal bearer is not exposed.

### Task 4: Documentation and integration contract

**Files:**
- Modify: `docs/integrations/email-whatsapp-relay.md`
- Modify: `docs/integrations/email-whatsapp-relay.openapi.yaml`
- Create: `docs/integrations/mcp-relay-connector.md`

- [ ] Document ChatGPT Settings → Connectors setup, OAuth discovery, approval, and the Gmail + MCP same-conversation workflow.
- [ ] Document local env names with redacted placeholders, dry-run testing, revocation, and explicit no-deploy status.
- [ ] Document that the connector is single-user and destination is server-configured.
- [ ] Keep the existing GPT Action contract unchanged.

### Task 5: Verification and final handoff

- [ ] Run focused OAuth/MCP tests with `EMAIL_RELAY_DRY_RUN=true`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm test:unit`.
- [ ] Run `pnpm harness:check`.
- [ ] Run `pnpm gov:verify`.
- [ ] Inspect `git diff`, branch, and worktree status; report any unmeasured production or ChatGPT UI proof explicitly.
- [ ] Stop before deployment or merge to `main`.
