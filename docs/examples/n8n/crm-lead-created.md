# Reference workflow — CRM `lead.created` → n8n → mock external side effect

> AI Platform Phase 6, Task 6 pilot. This is a **node-by-node reconstruction**,
> not a raw n8n export file. No live n8n instance was stood up for this task
> (see `docs/superpowers/sdd/2026-08-10-ai-platform-phase-6-n8n/task-6-brief.md`
> and Task 5's `docs/runbooks/n8n.md` for the standalone stack), so there is no
> real export to sanitize — a hand-authored JSON claiming to be a verified
> export would be misleading. This document is the source of truth for the
> pilot; import it by recreating the nodes below in a real n8n instance rather
> than importing a JSON file.
>
> Every URL, credential name, table name and secret reference in this document
> is synthetic or a placeholder. **Never** paste a real webhook secret,
> `dsk_...` token, production URL or n8n credential ID into this file.

## Pilot scope

```text
CRM lead.created
 -> automation rule (action type: n8n_webhook)
 -> lib/automation/actions/n8n-webhook.ts (executeN8nWebhook)
    -> buildN8nEnvelope (lib/automation/n8n/envelope.ts)
    -> deliverSignedWebhook (lib/automation/actions/call-webhook.ts)
 -> n8n Webhook trigger node (this document)
 -> validate HMAC-SHA256 signature + durable idempotency check
 -> mock external side effect (https://example.com/webhook-mock — synthetic,
    never a real production endpoint)
```

The CRM side of this contract (envelope shape, HMAC signing, retry/backoff,
anti-SSRF) already exists and is exercised by
`lib/automation/actions/n8n-webhook.test.ts` and
`tests/unit/n8n-integration-boundary.test.ts`. `tests/unit/n8n-reference-workflow.test.ts`
(this task) proves the CRM-side properties this document assumes: the envelope
shape sent over the wire, the HMAC algorithm the workflow must verify against,
and that the idempotency key is stable across retries — using the real
`buildN8nEnvelope`/`executeN8nWebhook` functions, not a re-implementation.

## Wire contract this workflow receives

`POST` request from `executeN8nWebhook`, body = JSON-serialized
`N8nIntegrationEnvelope` (`lib/automation/n8n/envelope.ts`):

```json
{
  "event_id": "<event_log row id, uuid>",
  "event_type": "lead.created",
  "occurred_at": "<ISO-8601 UTC>",
  "organization_ref": "<sha256(organization_id) truncated to 32 hex chars — opaque, not the raw org uuid>",
  "idempotency_key": "<automation_rule_id>:<event_log row id>",
  "data": {
    "workflow_key": "<configured on the automation rule action, e.g. 'lead-created-mock-notify'>",
    "pipeline_id": "<crm_pipelines.id>",
    "stage_id": "<crm_stages.id>",
    "title": "<crm_leads.title>"
  }
}
```

`data`'s shape beyond `workflow_key` comes directly from the real
`lead.created` event payload emitted by `app/api/v1/leads/_handler.ts`
(`p_payload: { pipeline_id, stage_id, title }` at lead-creation time) — this
document does not invent a payload shape; `pipeline_id`/`stage_id`/`title` are
the exact fields the existing automation engine (`lib/automation/engine.ts`)
already puts on that event today. No PII (contact name/phone/email) is in
this payload; if a future workflow needs contact data it must be pulled via
the least-privilege MCP path (Task 7 pilot,
`docs/runbooks/n8n-token.md`), not added to this outbound envelope.

Headers on the request:

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-Deskcomm-Signature` | Present only if the automation rule's `n8n_webhook` action has a `secret`/`secret_enc` configured. `hex(HMAC-SHA256(secret, <raw request body bytes>))`. Absent means the rule owner chose to run unsigned — the workflow below treats a request with no signature header as a configuration state to explicitly allow or reject, never a silent pass. |

## Node-by-node reconstruction

### 1. Webhook (trigger)

- Node type: `n8n-nodes-base.webhook`
- HTTP Method: `POST`
- Path: `crm-lead-created` (operator picks the actual path at import time;
  never reuse a path across pilots with different secrets)
- **Response Mode: "Using 'Respond to Webhook' Node"** — required. The
  default "immediately" mode would ack before HMAC/idempotency validation
  runs, which would make a forged or replayed request indistinguishable from
  a real one from the CRM's point of view (a 200 tells `deliverSignedWebhook`
  to stop retrying).
- **Options → Raw Body: enabled.** The signature in Step 2 must be computed
  over the *exact bytes* the CRM sent. If n8n re-serializes the parsed JSON
  before hashing, key ordering/whitespace differences silently break every
  signature check. Raw body must be available downstream as
  `{{$json.body}}` (string).
- Authentication: **None** at the node level. HMAC verification (Step 2) is
  the authentication mechanism for this endpoint, matching the CRM's WAHA
  and generic-webhook doctrine of validating signatures explicitly rather
  than relying on a transport-level secret in the URL/query string.

### 2. Code — "Verify X-Deskcomm-Signature"

Pseudocode (Node.js, `n8n-nodes-base.code`, mode: "Run Once for All Items"):

```js
const crypto = require('crypto');

// Shared secret lives ONLY in an n8n environment variable set at the
// container level (ops/n8n/.env on the standalone stack, Task 5), never in
// this workflow's JSON/credentials export. Rotate it the same way any other
// webhook secret is rotated (docs/runbooks/n8n.md, docs/runbooks/n8n-token.md).
const secret = $env.CRM_N8N_WEBHOOK_SECRET;

const item = $input.first().json;
const rawBody = item.body; // exact bytes, thanks to Raw Body option in Step 1
const receivedSig = (item.headers['x-deskcomm-signature'] || '').toLowerCase();

let valid = false;
if (secret && receivedSig) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(receivedSig, 'hex');
  // Timing-safe compare requires equal length; unequal length is just invalid,
  // never thrown/leaked as a timing signal.
  valid = a.length === b.length && crypto.timingSafeEqual(a, b);
}

const envelope = JSON.parse(rawBody);

return [{
  json: {
    signature_valid: valid,
    envelope,
  },
}];
```

This mirrors the exact algorithm `deliverSignedWebhook`
(`lib/automation/actions/call-webhook.ts`) uses to sign:
`createHmac("sha256", secret).update(body).digest("hex")`, and uses a
constant-time comparison the same way the CRM's own inbound WAHA/webhook
verifiers do (fail closed, no early-return timing leak).

### 3. IF — "Signature valid?"

- Condition: `{{$json.signature_valid}} === true`
- **False branch** → node 3b below.
- **True branch** → node 4.

### 3b. Respond to Webhook — "401 invalid signature"

- Response Code: `401`
- Response Body: `{"error": "invalid_signature"}`
- Terminal node on this branch. No side effect runs, nothing is written to
  the dedupe table — a forged/tampered request must never claim a real
  event's idempotency key.

### 4. Postgres — "Claim idempotency key"

Runs against **n8n's own dedicated Postgres** (`n8n-postgres` in
`ops/n8n/docker-compose.yml`, Task 5) — never the CRM's Supabase/Postgres.
This is a durable store (survives n8n process restarts), not in-memory
dedup, satisfying the brief's "supported persistent store, not process
memory" requirement.

One-time setup (run manually against `n8n-postgres`, not via a CRM
migration — this table is n8n-pilot-local state, not CRM schema):

```sql
create table if not exists n8n_crm_lead_created_dedupe (
  idempotency_key text primary key,
  claimed_at timestamptz not null default now()
);
```

Node query (parameterized, `$1` bound to
`{{$json.envelope.idempotency_key}}`):

```sql
insert into n8n_crm_lead_created_dedupe (idempotency_key)
values ($1)
on conflict (idempotency_key) do nothing
returning idempotency_key;
```

`INSERT ... ON CONFLICT DO NOTHING RETURNING` is the whole dedupe mechanism
in one atomic statement — no separate SELECT-then-INSERT, so two concurrent
deliveries of the same retried request (e.g. the CRM's own 3-attempt retry
in `deliverSignedWebhook`, or an operator manually replaying a webhook test)
cannot both "win" the claim. Exactly one execution gets a returned row for a
given `idempotency_key`; every other execution — including true retries —
gets zero rows back deterministically.

### 5. IF — "Claimed (first delivery)?"

- Condition: node 4's output has at least one item (a row was returned).
- **False branch** (0 rows — this `idempotency_key` was already claimed by
  an earlier execution) → node 5b below. This is the retry-does-not-duplicate
  path: the mock external side effect (node 6) is never reached again for a
  duplicate/retried delivery.
- **True branch** → node 6.

### 5b. Respond to Webhook — "200 duplicate, skipped"

- Response Code: `200`
- Response Body: `{"status": "duplicate_skipped"}`
- A 2xx here is intentional: `deliverSignedWebhook` treats any non-2xx as
  retryable, and a duplicate is not an error — it is the dedupe mechanism
  working as intended. Returning 200 stops the CRM from retrying further.

### 6. HTTP Request — "Mock external side effect"

- Method: `POST`
- URL: `https://example.com/webhook-mock` — **synthetic placeholder only**.
  Never point this node at a real customer-facing endpoint, real email/SMS
  provider, or any production URL as part of this reference pilot. A real
  workflow built from this reference swaps this node for whatever the actual
  integration is (and inherits/adjusts the idempotency handling in nodes 4–5
  to that target's own semantics, e.g. an `Idempotency-Key`-aware API,
  per the brief's "use... external API idempotency where supported").
- Headers: `Content-Type: application/json`,
  `Idempotency-Key: {{$json.envelope.idempotency_key}}` (defense in depth —
  forwarded even though `example.com` is a mock target with no real
  idempotency contract of its own; a target that does support one should be
  relied on in addition to, not instead of, node 4's claim).
- Body (only the fields the downstream mock actually needs — never forward
  the full envelope verbatim to an external system by default):
  ```json
  {
    "event_type": "{{$json.envelope.event_type}}",
    "lead_title": "{{$json.envelope.data.title}}",
    "pipeline_id": "{{$json.envelope.data.pipeline_id}}"
  }
  ```
- On non-2xx: node's own "Continue on Fail" is **off** — a failed side
  effect falls through to node 6b. The dedupe row from node 4 is
  deliberately **not deleted** on failure; a real integration should decide,
  based on that target's own retry/idempotency contract, whether a failed
  side effect should be requeued (e.g. via a separate durable queue/table)
  rather than relying on the CRM's own retry to naturally re-attempt (the
  CRM's `idempotency_key` for this event is fixed, so a naive "delete the
  dedupe row on failure" would just let the CRM's existing 3-attempt retry
  paper over it — that only works if the CRM retries within the same
  webhook delivery window, which is not guaranteed).

### 6b. Respond to Webhook — "502 side effect failed"

- Response Code: `502`
- Response Body: `{"status": "side_effect_failed"}`
- This is a 5xx on purpose: it is the one case where re-delivery from the
  CRM's retry (`deliverSignedWebhook`, up to 3 attempts) is actually useful
  — but note it will hit node 4 again with the *same* `idempotency_key` and
  get short-circuited to node 5b (duplicate) rather than re-attempting node 6.
  This reference pilot intentionally does not solve "retry the side effect
  itself" beyond what's shown here; a production workflow built from this
  reference needs its own requeue/backoff node for that target's failure
  semantics.

### 7. Respond to Webhook — "200 success"

- Response Code: `200`
- Response Body: `{"status": "ok"}`
- Terminal node for the success path.

## Connections

```text
Webhook - CRM lead.created
  -> Code - Verify X-Deskcomm-Signature
    -> IF - Signature valid?
       true  -> Postgres - Claim idempotency key
                 -> IF - Claimed (first delivery)?
                    true  -> HTTP Request - Mock external side effect
                              -> (success) Respond 200 success
                              -> (failure) Respond 502 side effect failed
                    false -> Respond 200 duplicate, skipped
       false -> Respond 401 invalid signature
```

## Sanitization checklist (brief Step 4)

- [x] No n8n credential IDs (`Postgres`/`HTTP Request` credentials are
      referenced by name only — `n8n-postgres` and, if the HTTP Request node
      needs its own auth for a real target, whatever credential name the
      operator creates — never an id).
- [x] No n8n execution payloads (no real `event_id`/`organization_ref`/lead
      data from an actual tenant appears anywhere in this document).
- [x] No real webhook secret — `CRM_N8N_WEBHOOK_SECRET` is documented as an
      environment-variable *name*, never a value.
- [x] No production URL — the only external URL is the synthetic
      `https://example.com/webhook-mock`.
- [x] No `dsk_...` bearer token (this pilot is CRM→n8n only; the n8n→CRM
      bearer token contract is Task 7's `docs/examples/n8n/crm-read-write.md`).

## References

- `lib/automation/actions/n8n-webhook.ts` — `executeN8nWebhook`, builds the
  envelope and signs the request this workflow receives.
- `lib/automation/n8n/envelope.ts` — `buildN8nEnvelope`, the wire format.
- `lib/automation/actions/call-webhook.ts` — `deliverSignedWebhook`, the
  shared transport (HMAC, anti-SSRF, retry/backoff, timeout).
- `app/api/v1/leads/_handler.ts` — real producer of the `lead.created` event
  whose payload shape this document's `data` field is derived from.
- `docs/runbooks/n8n.md` — standalone n8n stack (`ops/n8n/docker-compose.yml`,
  its own dedicated Postgres referenced by node 4).
- `tests/unit/n8n-reference-workflow.test.ts` — proves the CRM-side
  properties this document assumes (envelope shape, HMAC algorithm,
  idempotency-key stability across retries) against the real production code.
