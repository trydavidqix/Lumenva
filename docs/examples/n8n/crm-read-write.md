# Reference workflow — n8n → CRM scoped read + write via `/api/mcp`

> AI Platform Phase 6, Task 7 pilot (`docs/superpowers/sdd/2026-08-10-ai-platform-phase-6-n8n/task-7-brief.md`).
> This is a **node-by-node reconstruction**, not a raw n8n export file — same
> reasoning as Task 6's `crm-lead-created.md`: no live n8n instance was stood
> up for this task, so there is no real export to sanitize, and a
> hand-authored JSON claiming to be a verified export would be misleading.
> This document is the source of truth for the pilot; import it by
> recreating the nodes below in a real n8n instance rather than importing a
> JSON file.
>
> Every URL, credential name, lead id and token in this document is
> synthetic or a placeholder. **Never** paste a real `dsk_...` bearer token,
> production URL, or n8n credential id into this file.

## Pilot scope

```text
External signal (e.g. n8n's own payment-webhook trigger, cron, manual test)
 -> n8n HTTP Request node #1: POST /api/mcp, tools/call "crm_get_lead"
    (READ — lib/mcp/tools/leads.ts)
 -> IF: lead belongs to the token's own org and is in the expected state?
 -> n8n HTTP Request node #2: POST /api/mcp, tools/call "crm_manage_tags"
    (WRITE, scoped — lib/mcp/tools/governance.ts, target_kind="lead")
 -> Respond / log outcome
```

Both nodes call the **same, existing MCP tool catalog** consumed by
`app/api/mcp/route.ts` — no new tool, no generic query/SQL tool, per the
brief's "do not invent new broad generic tools" constraint
(`lib/mcp/tools/index.ts`, `docs/runbooks/n8n-token.md`).

- **Read tool: `crm_get_lead`** — `category: "read"`, `requiresScope:
  "mcp:read"`, `requiresRole: "agent"`. Returns a single lead by UUID,
  scoped to the token's org.
- **Write tool: `crm_manage_tags`** (`target_kind: "lead"`) —
  `category: "write"`, `requiresScope: "mcp:write"`, `requiresRole: "agent"`.
  Adds/removes tags on a lead, scoped to the token's org. Chosen over a
  stage-move or lead-edit tool because it is the narrowest, most legible
  "external system marks a CRM record" write — a payment webhook or delivery
  confirmation coming through n8n should tag the lead (`payment_confirmed`,
  `delivery_failed`, etc.), not silently rewrite its stage or core fields.

Narrative: an external event outside the CRM (payment gateway, logistics
webhook, anything n8n already watches) needs to leave a mark on the matching
CRM lead. The workflow reads the lead to confirm it exists and belongs to
the calling token's org, then tags it. Both steps go through the same
least-privilege bearer token — never the service-role key, never a direct
database write (`tests/unit/n8n-integration-boundary.test.ts` locks that no
n8n-specific code imports `lib/supabase/admin`).

## Wire contract

Endpoint: `POST /api/mcp` (`app/api/mcp/route.ts`), MCP Streamable HTTP
transport, JSON-RPC 2.0. Every call carries:

```http
POST /api/mcp
Authorization: Bearer dsk_<one-time-token>
Content-Type: application/json
```

`organization_id` is **never** read from the request body. It is resolved
exclusively from the `api_tokens` row matched by the bearer's hash
(`validateBearerToken`, `lib/mcp/auth.ts`). A payload that includes a
`lead_id`/`target_id` belonging to a different organization has no special
effect — every tool delegates to the same REST handlers that filter every
query by `ctx.organizationId`, so the call either 404s / errors, or resolves
to nothing, never to the other org's row
(`tests/unit/n8n-inbound-contract.test.ts`, this task, proves this
concretely for both `crm_get_lead` and `crm_manage_tags`).

### Request body — `tools/call`

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "crm_get_lead",
    "arguments": { "lead_id": "<crm_leads.id, uuid>" }
  }
}
```

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "crm_manage_tags",
    "arguments": {
      "target_kind": "lead",
      "target_id": "<crm_leads.id, uuid>",
      "add": ["payment_confirmed"]
    }
  }
}
```

### Two different failure shapes — read the response body, not only the HTTP status

Reading `app/api/mcp/route.ts` and `lib/mcp/server.ts` directly (this was
verified against source, not against a live transport — no n8n instance was
run for this task, same limitation as Task 6):

1. **Auth failure — missing/malformed/unrecognized/revoked/expired token.**
   `validateBearerToken` throws `McpAuthError` **before** the MCP server is
   even constructed. `route.ts`'s `handle()` catches it and returns a
   **top-level JSON-RPC error envelope with the real HTTP status** —
   `401` for every auth failure (`-32001`), `500` for an unexpected auth
   backend error (`-32603`):
   ```json
   { "jsonrpc": "2.0", "error": { "code": -32001, "message": "Token revoked." }, "id": null }
   ```
   An n8n `IF` node can check the HTTP status code directly for this case.

2. **Scope/role failure — token is valid but lacks `mcp:read`/`mcp:write`
   or the tool's minimum role.** This happens **inside** `registerTool`'s
   handler (`lib/mcp/server.ts`), after the MCP server already accepted the
   connection. `ensureScope`/`ensureRole` throw `McpAuthError`, but
   `lib/mcp/server.ts` catches it and returns a **successful MCP tool
   result** with `isError: true` — the JSON-RPC/HTTP envelope itself is
   **not** a 401/403; only the tool result inside it signals the failure:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "result": {
       "isError": true,
       "content": [{ "type": "text", "text": "Token missing required scope 'mcp:write'." }]
     }
   }
   ```
   **An n8n workflow built from this reference must check
   `{{$json.result.isError}}`, not just the HTTP status code**, to detect a
   scope/role denial. Checking HTTP status alone would treat this as
   "success" and proceed past the gate. This is the single most important
   correctness detail in this document — get it wrong and the workflow's
   own error-branch silently never fires for a wrong-scope token.

3. **Rate limit.** `120` calls/minute per org; exceeded returns a top-level
   `429` with `-32000` (`app/api/mcp/route.ts`, `checkRateLimit`).

4. **Success.**
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "result": {
       "structuredContent": { "lead": { "id": "...", "stage_id": "...", "status": "open", "tags": [] } },
       "content": [{ "type": "text", "text": "{\"lead\":{...}}" }]
     }
   }
   ```
   Prefer `result.structuredContent` over parsing `result.content[0].text`
   when the n8n node supports it — it is already an object, not a
   JSON-encoded string.

Every call (success or error) generates `api_audit_log` with
`action: "mcp.tool_called"` — fire-and-forget, per `lib/mcp/audit.ts`; a
failed audit write never blocks the tool response but is visible
operationally (`.claude/rules/audit-observability.md`).

## Node-by-node reconstruction

### 1. Trigger

- Node type: whatever fires the external signal in the real deployment
  (Webhook, Cron, or — for this reference pilot — a **Manual Trigger** for
  operator testing). Not prescribed here; the CRM-side contract below is
  identical regardless of what starts the workflow.

### 2. HTTP Request — "crm_get_lead"

- Method: `POST`
- URL: `https://<crm-host>/api/mcp` — placeholder; never the literal
  production hostname in a shared workflow export.
- Authentication: **Header Auth credential** (n8n credential type *HTTP
  Header Auth*), header name `Authorization`, value `Bearer
  {{$credentials.crmToken}}` — **never** hardcode the token in the node's
  JSON, never in the URL/query string (repo doctrine:
  `.claude/rules/security.md`, "API key/token nunca vai em query string").
- Body (JSON):
  ```json
  {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": { "name": "crm_get_lead", "arguments": { "lead_id": "{{$json.lead_id}}" } }
  }
  ```
  `lead_id` comes from whatever the trigger's own payload maps to a CRM lead
  (e.g. a `crm_lead_id` field the external system already carries) — never
  invent a lookup-by-name/email shortcut here; if the trigger only has an
  external identifier, resolve it to a `lead_id` via a search tool
  (`crm_list_leads`/`crm_search_contacts`) in an earlier node, not by
  guessing.

### 3. IF — "Auth failed (HTTP-level)?"

- Condition: HTTP status code `>= 400` (n8n's HTTP Request node exposes this
  without extra code when "Never Error" / continue-on-fail is enabled on the
  node, so the workflow can branch instead of throwing).
- **True** → 3b. **False** → 4.

### 3b. Respond/log — "auth failed"

- Logs `{{$json.statusCode}}` and the top-level `error.message` (e.g. "Token
  revoked.", "Token expired.", "Token not recognized."). Terminal on this
  branch — a revoked/expired/unrecognized token stops the workflow here,
  before node 4 ever runs, and definitely before node 6 (the write) is
  reached.

### 4. IF — "Tool-level error (scope/role denied)?"

- Condition: `{{$json.result.isError}}` **is `true`**. This is the check
  described above in "Two different failure shapes" — a wrong-scope token
  passes node 3 (HTTP 200) and must be caught **here**, not there.
- **True** → 4b. **False** → 5.

### 4b. Respond/log — "scope/role denied"

- Logs `{{$json.result.content[0].text}}` (e.g. "Token missing required
  scope 'mcp:read'."). Terminal on this branch.

### 5. IF — "Lead resolved and belongs to an expected state?"

- Condition: `{{$json.result.structuredContent.lead}}` exists (a 404 from
  `crm_get_lead` — including the case where `lead_id` is real but belongs to
  a **different** org than the token's — surfaces as a tool-level error, so
  it is already caught by node 4 above; by the time execution reaches node
  5, `lead` is guaranteed to belong to the calling token's own org) **and**
  whatever business condition the real integration cares about (e.g.
  `status === "open"`).
- **False** → 5b (nothing to tag; not an error, just a no-op). **True** → 6.

### 5b. Respond/log — "no matching open lead, skipped"

Terminal, non-error branch.

### 6. HTTP Request — "crm_manage_tags"

- Same URL/credential as node 2 (same token — one credential per workflow
  scope, per `docs/runbooks/n8n-token.md`; do not create a second, more
  privileged credential just for this node).
- Body (JSON):
  ```json
  {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "crm_manage_tags",
      "arguments": {
        "target_kind": "lead",
        "target_id": "{{$json.result.structuredContent.lead.id}}",
        "add": ["payment_confirmed"]
      }
    }
  }
  ```
  `target_id` is taken from node 2's **own resolved lead**, never re-sent
  from the original trigger payload — this is what keeps the write scoped
  to the exact row the read just proved belongs to the token's org, instead
  of trusting an external system's own id a second time.

### 7. IF / 7b / 8 — same auth/scope shape as nodes 3–4

Repeat the HTTP-level (`statusCode >= 400`) and tool-level
(`result.isError`) checks from nodes 3–4 for this second call before
treating the tag write as applied. A token that was valid for the read but
gets revoked between node 2 and node 6 (operator revokes it mid-run) must
still be caught here — the write is not assumed safe just because the read
succeeded earlier in the same execution.

### 9. Respond/log — "tagged"

Terminal success branch.

## Connections

```text
Trigger
 -> HTTP Request - crm_get_lead
   -> IF - Auth failed (HTTP-level)?
      true  -> Respond - auth failed
      false -> IF - Tool-level error (scope/role denied)?
         true  -> Respond - scope/role denied
         false -> IF - Lead resolved and belongs to expected state?
            false -> Respond - no matching open lead, skipped
            true  -> HTTP Request - crm_manage_tags
                      -> IF - Auth failed (HTTP-level)?
                         true  -> Respond - auth failed (write)
                         false -> IF - Tool-level error (scope/role denied)?
                            true  -> Respond - scope/role denied (write)
                            false -> Respond - tagged
```

## Credential setup (brief Step 4 — no real secret, placeholder syntax only)

This pilot reuses the existing `api_tokens` mechanism end to end — see
`docs/runbooks/n8n-token.md` (Task 4) for the full runbook. Summary specific
to this workflow:

1. In the CRM, as an `admin`-role user: `/app/settings/api-tokens` → **Criar
   token**. Name it for this specific workflow (e.g. `n8n - payment
   confirmation tagger`), not a generic "n8n" shared across workflows.
2. Scopes: check **`mcp:read`** and **`mcp:write`** only. Do **not** check
   `role:manager` — both `crm_get_lead` and `crm_manage_tags` only require
   `requiresRole: "agent"`, the implicit default when no `role:*` scope is
   set. Do **not** check `role:admin` — no tool in the catalog needs it
   (`tests/unit/n8n-mcp-scope.test.ts`, Task 4).
3. Set an expiration (`expires_in_days`) appropriate to the pilot's
   lifetime; only leave it unset for a production token with a clear owner
   and rotation process.
4. Copy the one-time plaintext (`dsk_<prefix>_<secret>`) **once**, into the
   operational vault (`docs/runbooks/ai-platform-secrets.md` — Infisical for
   controlled runtime, never `.env.example`, repo, log, or this document).
5. In n8n: create a credential of type **HTTP Header Auth**. Header name
   `Authorization`, header value `Bearer dsk_<one-time-token>` — the
   plaintext lives only inside that credential's encrypted storage (n8n's
   own `N8N_ENCRYPTION_KEY`, `infra/deployment/n8n/docker-compose.yml`, Task 5), never in
   the workflow JSON itself and never in a query string. Name the credential
   after the workflow (`crm-token-payment-confirmation-tagger`), not a
   shared generic name — a leaked/compromised workflow's token can then be
   revoked without touching any other workflow's credential.
6. If the token is ever suspected leaked (exported workflow shared
   carelessly, n8n instance compromised), revoke it immediately via
   `/app/settings/api-tokens` (idempotent — revoking an already-revoked
   token is a no-op, not an error) rather than waiting for expiration.

Placeholder syntax used throughout this document: `dsk_<one-time-token>`,
`https://<crm-host>`, `{{$credentials.crmToken}}`. None of these are
resolvable secrets or real hosts.

## Sanitization checklist

- [x] No real `dsk_...` bearer token — only `dsk_<one-time-token>` /
      `{{$credentials.crmToken}}` placeholders.
- [x] No real hostname — only `<crm-host>` placeholder.
- [x] No n8n credential id — the credential is referenced by name/type only.
- [x] No real lead/organization id — only synthetic UUIDs in the paired test
      file (`tests/unit/n8n-inbound-contract.test.ts`), never in this
      document.
- [x] No real execution payload/audit log content pasted from a live run
      (none was run — see the disclaimer at the top of this document).

## Tests that prove this contract

`tests/unit/n8n-inbound-contract.test.ts` (this task) proves, against the
real `crm_get_lead` / `crm_manage_tags` handlers and the real
`validateBearerToken` / `ensureScope` / `ensureRole` gates in the same order
`lib/mcp/server.ts` applies them:

- **Read tool success**: a valid, correctly-scoped token reads a real lead
  belonging to its own org.
- **Read tool, 3 fail-closed cases**: revoked token (401), expired token
  (401), token missing `mcp:read` (403) — in every case the business-data
  supabase client is never even touched (proven with a stub that throws if
  invoked).
- **Write tool success**: a valid, correctly-scoped token tags a real lead
  belonging to its own org; the mutation is captured and asserted exactly.
- **Write tool, 3 fail-closed cases**: revoked (401), expired (401), token
  missing `mcp:write` (403) — no mutation is ever captured by the stub.
- **Forged tenant id**: a token for org A calling either tool with a real
  `lead_id`/`target_id` that belongs to org B fails (404 for the read,
  `target_not_found` for the write) and captures zero mutations — with a
  positive control proving the same stub does resolve that row for a
  context that genuinely belongs to org B, so the negative result is the
  tenant filter working, not an empty stub.
- Documentation sanitization/completeness checks against this file itself.

What this test file does **not** prove (documented as an explicit
limitation, same honesty standard as Task 6): the exact JSON-RPC/HTTP
envelope shapes in the "Two different failure shapes" section above were
verified by reading `app/api/mcp/route.ts` and `lib/mcp/server.ts` directly,
not by driving the real `@modelcontextprotocol/sdk` Streamable HTTP
transport end-to-end in a test. If a future change touches that transport
wiring, re-verify the `result.isError` vs top-level-`error` distinction
against the live route before trusting this document's wire examples
verbatim.

## References

- `lib/mcp/auth.ts` — `validateBearerToken`, `ensureScope`, `ensureRole`.
- `lib/mcp/server.ts` — the exact gate order (`ensureScope` then
  `ensureRole` then the handler) and the `isError: true` wrapping for
  scope/role failures.
- `lib/mcp/tools/leads.ts` — `crmGetLead`.
- `lib/mcp/tools/governance.ts` — `crmManageTags`.
- `app/api/mcp/route.ts` — the HTTP/JSON-RPC endpoint, rate limit, top-level
  auth error envelope.
- `docs/runbooks/n8n-token.md` (Task 4) — full least-privilege token
  provisioning runbook, scope/role recommendations, revocation.
- `docs/runbooks/n8n.md` (Task 5) — standalone n8n stack, credential
  storage (`N8N_ENCRYPTION_KEY`).
- `docs/examples/n8n/crm-lead-created.md` (Task 6) — the paired outbound
  (CRM → n8n) reference workflow.
- `tests/unit/n8n-inbound-contract.test.ts` — proves the properties this
  document assumes.
- `tests/unit/n8n-mcp-scope.test.ts` (Task 4) — proves the scope/role gates
  against the full live tool catalog.
- `tests/unit/n8n-integration-boundary.test.ts` (Task 1) — proves
  `organizationId` only ever comes from `api_tokens`.
