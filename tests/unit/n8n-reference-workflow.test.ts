/**
 * AI Platform Phase 6 (n8n) — Task 6: proves the properties the reference
 * workflow document (`docs/examples/n8n/crm-lead-created.md`) assumes,
 * against the REAL CRM-side production code — `buildN8nEnvelope`
 * (lib/automation/n8n/envelope.ts) and `executeN8nWebhook`
 * (lib/automation/actions/n8n-webhook.ts), which in turn calls the real
 * shared transport `deliverSignedWebhook` (lib/automation/actions/call-webhook.ts).
 *
 * No live n8n instance exists for this task (see task-6-brief.md and the
 * session context: standing one up was out of scope). Two things are
 * proven instead, at the level this repo controls:
 *
 * 1. The documentation artifact itself is sanitized (no secrets, no
 *    production URLs) and structurally complete (every node/branch the
 *    brief's pilot diagram requires is actually documented).
 * 2. The CRM-side envelope/signing/idempotency behavior the document's
 *    n8n-side logic depends on (HMAC-SHA256 over the exact body,
 *    deterministic idempotency_key, real lead.created payload shape) holds
 *    against the real code — including a receiver test double that
 *    implements EXACTLY the doc's node-by-node verify+dedupe algorithm
 *    (Steps 2-6 of the markdown), so "retry does not duplicate the mock
 *    side effect" is proven end-to-end against real signing/delivery code,
 *    not asserted from documentation alone.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, afterEach, vi } from "vitest";
import type { ActionCtx } from "@/lib/automation/types";

// I3 fix: executeN8nWebhook now gates on the "n8n" AI Platform feature
// before delivering — this suite is about envelope/signing/idempotency
// behavior, not the gate, so the feature is fixed to "on" here. Same seam as
// lib/automation/actions/n8n-webhook.test.ts and
// lib/agent-engine/obs/external-tracing-config.test.ts.
vi.mock("@/lib/agent-engine/platform/features", () => ({
  resolveAiPlatformFeature: vi.fn().mockResolvedValue({ mode: "on", config: {}, killed: false }),
}));

import { executeN8nWebhook } from "@/lib/automation/actions/n8n-webhook";
import { buildN8nEnvelope, type N8nIntegrationEnvelope } from "@/lib/automation/n8n/envelope";

const REPO_ROOT = join(__dirname, "..", "..");
const DOC_PATH = join(REPO_ROOT, "docs", "examples", "n8n", "crm-lead-created.md");

function readDoc(): string {
  return readFileSync(DOC_PATH, "utf8");
}

// Realistic (non-sequential, mixed hex) v4-shaped uuids — a repeated-digit
// placeholder like "6666...6" is indistinguishable from a 13-19 digit card
// number to the shared secret sanitizer (sanitizeMemoryCandidate) that
// buildN8nEnvelope runs over every data field, so fixtures use real hex.
function baseCtx(overrides: Partial<ActionCtx["event"]> = {}): ActionCtx {
  return {
    admin: {} as ActionCtx["admin"],
    organizationId: "a6b20d3c-efe1-46a1-aa00-05685a11bef2",
    ruleId: "72f7d31c-aafb-41f7-855d-41cb909dc1ec",
    requestId: "req-1",
    event: {
      id: "ff490553-6c1b-4183-a7f8-5945c7b328a1",
      organization_id: "a6b20d3c-efe1-46a1-aa00-05685a11bef2",
      event_type: "lead.created",
      entity_kind: "crm_lead",
      entity_id: "a3d3c6b2-6968-4c58-bcc9-92aae1186a78",
      // Real shape emitted by app/api/v1/leads/_handler.ts at lead-creation
      // time (p_payload: { pipeline_id, stage_id, title }) — not invented.
      payload: {
        pipeline_id: "bd88a08d-de84-4a52-8b80-0b4a73b5dcd2",
        stage_id: "ad5ee885-ea7e-411a-b380-11aab9b99610",
        title: "Cliente Exemplo — pedido de orçamento",
      },
      metadata: {},
      consumed_by: [],
      attempts: 0,
      ...overrides,
    },
    context: {},
  };
}

async function listen(server: Server): Promise<{ port: number; close: () => Promise<void> }> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    port,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

// ---------------------------------------------------------------------------
// Group A — the documentation artifact itself: sanitized + structurally
// complete against the brief's pilot diagram and Step 4 checklist.
// ---------------------------------------------------------------------------

describe("docs/examples/n8n/crm-lead-created.md — sanitization (brief Step 4)", () => {
  it("exists and is non-trivial (not a stub)", () => {
    const doc = readDoc();
    expect(doc.length).toBeGreaterThan(2000);
  });

  it("every https:// URL in the document points at the synthetic mock host, never a production domain", () => {
    const doc = readDoc();
    const urls = [...doc.matchAll(/https?:\/\/[^\s`)]+/g)].map((m) => m[0]);
    expect(urls.length).toBeGreaterThan(0); // guard against an empty/vacuous scan
    for (const url of urls) {
      const host = new URL(url).host;
      expect(host, `unexpected non-mock host in reference doc: ${url}`).toBe("example.com");
    }
  });

  it("never contains a real-looking dsk_ bearer token value", () => {
    const doc = readDoc();
    // Real tokens are dsk_<8 hex>_<32-byte-random>. The doc only ever writes
    // the literal placeholder "dsk_..." (three dots, no trailing secret body).
    expect(doc).not.toMatch(/dsk_[a-f0-9]{6,}_[A-Za-z0-9+/=]{10,}/);
  });

  it("never contains a long hex/base64 string that would look like a real secret or credential id", () => {
    const doc = readDoc();
    // Anything 32+ contiguous hex chars would be secret/credential-id-shaped
    // (organization_ref is documented as a *description*, never an actual
    // computed value, in this file).
    expect(doc).not.toMatch(/\b[A-Fa-f0-9]{32,}\b/);
  });

  it("does not paste an actual HMAC secret value (only the env var NAME, as prose)", () => {
    const doc = readDoc();
    // The only acceptable form is referencing the env var name in code/prose;
    // reject anything that assigns it to a concrete value like `= "...">`.
    expect(doc).not.toMatch(/CRM_N8N_WEBHOOK_SECRET\s*=\s*['"][^'"]+['"]/);
  });

  it("documents the real lead.created producer instead of inventing a payload shape", () => {
    const doc = readDoc();
    expect(doc).toMatch(/app\/api\/v1\/leads\/_handler\.ts/);
    expect(doc).toMatch(/pipeline_id/);
    expect(doc).toMatch(/stage_id/);
  });
});

describe("docs/examples/n8n/crm-lead-created.md — structural completeness against the pilot diagram", () => {
  const doc = readDoc();

  it.each([
    ["Webhook trigger node", /n8n-nodes-base\.webhook/],
    ["Raw body requirement (byte-exact HMAC input)", /Raw Body/i],
    ["HMAC verification step", /HMAC-SHA256/],
    ["constant-time signature comparison", /timingSafeEqual/],
    ["signed header name", /X-Deskcomm-Signature/],
    ["invalid-signature rejection with no side effect", /invalid_signature/],
    ["durable (not in-memory) idempotency claim", /durable/i],
    ["atomic dedupe claim, not check-then-insert", /on conflict \(idempotency_key\) do nothing/i],
    ["duplicate/retry short-circuit response", /duplicate_skipped/],
    ["mock external side effect target", /example\.com\/webhook-mock/],
    ["side-effect failure path", /side_effect_failed/],
    ["success response", /"status":\s*"ok"/],
  ])("mentions: %s", (_label, pattern) => {
    expect(doc).toMatch(pattern);
  });
});

// ---------------------------------------------------------------------------
// Group B — envelope shape the document's `data` contract assumes, built
// from a realistic lead.created event via the real buildN8nEnvelope.
// ---------------------------------------------------------------------------

describe("envelope shape matches what the reference document documents as `data`", () => {
  it("buildN8nEnvelope(workflow_key + real lead.created payload) yields exactly the documented fields", () => {
    const ctx = baseCtx();
    const envelope = buildN8nEnvelope({
      eventId: ctx.event.id,
      eventType: ctx.event.event_type,
      occurredAt: "2026-08-16T12:00:00.000Z",
      organizationId: ctx.organizationId,
      idempotencyKey: `${ctx.ruleId}:${ctx.event.id}`,
      data: { workflow_key: "lead-created-mock-notify", ...ctx.event.payload },
    });

    expect(envelope.event_type).toBe("lead.created");
    expect(Object.keys(envelope.data).sort()).toEqual(
      ["pipeline_id", "stage_id", "title", "workflow_key"].sort(),
    );
    expect(envelope.data.pipeline_id).toBe(ctx.event.payload.pipeline_id);
    expect(envelope.data.stage_id).toBe(ctx.event.payload.stage_id);
    expect(envelope.data.title).toBe(ctx.event.payload.title);
    // organization_ref is opaque — never the raw uuid (doc explicitly says so).
    expect(envelope.organization_ref).toMatch(/^[a-f0-9]{32}$/);
    expect(envelope.organization_ref).not.toContain(ctx.organizationId);
  });
});

// ---------------------------------------------------------------------------
// Group C — brief Step 2: signed payload verifies per the documented
// algorithm, and idempotency_key/data are stable across a retry.
// ---------------------------------------------------------------------------

describe("Step 2 — signed payload + stable idempotency across a retry", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
  });

  it("HMAC-SHA256(secret, raw body) computed per the doc's Step 2 algorithm validates the real signed request, and idempotency_key/data survive a retried delivery unchanged", async () => {
    const received: { body: string; sig: string | undefined }[] = [];
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        received.push({
          body: Buffer.concat(chunks).toString("utf8"),
          sig: (req.headers["x-deskcomm-signature"] as string | undefined)?.toLowerCase(),
        });
        res.writeHead(200);
        res.end("ok");
      });
    });
    const { port, close } = await listen(server);

    const secret = "reference-workflow-secret-16ch";
    const ctx = baseCtx();
    const config = {
      url: `http://127.0.0.1:${port}/hook`,
      workflow_key: "lead-created-mock-notify",
      secret,
    };

    const r1 = await executeN8nWebhook(ctx, config, { skipUrlCheck: true });
    // Simulate a retried delivery of the SAME event through the SAME rule
    // (e.g. CRM-side retry, or an operator manually re-triggering delivery).
    const r2 = await executeN8nWebhook(ctx, config, { skipUrlCheck: true });

    expect(r1.status).toBe("success");
    expect(r2.status).toBe("success");
    expect(received).toHaveLength(2);

    // Doc Step 2's exact verification algorithm, reproduced here as the
    // n8n-side verifier would run it — proves the two are compatible.
    for (const item of received) {
      expect(item.sig, "every delivery must be signed").toBeDefined();
      const expected = createHmac("sha256", secret).update(item.body).digest("hex");
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(item.sig!, "hex");
      expect(a.length).toBe(b.length);
      expect(timingSafeEqual(a, b)).toBe(true);
    }

    const [env1, env2] = received.map((r) => JSON.parse(r.body) as N8nIntegrationEnvelope);
    expect(env1).toBeDefined();
    expect(env2).toBeDefined();
    expect(env2!.idempotency_key).toBe(env1!.idempotency_key);
    expect(env2!.event_id).toBe(env1!.event_id);
    expect(env2!.data).toEqual(env1!.data);

    await close();
  });
});

// ---------------------------------------------------------------------------
// Group D — brief Step 3: retry does not duplicate the mock side effect.
//
// The receiver below is a test double that implements EXACTLY the doc's
// nodes 2-6 (HMAC verify -> atomic dedupe claim -> mock side effect),
// standing in for n8n's own dedicated Postgres (docs/runbooks/n8n.md,
// ops/n8n/docker-compose.yml) with an in-process Set — durable Postgres
// storage is what a real deployment uses (per the doc); this test proves
// the ALGORITHM the doc specifies is race-safe and retry-safe, driven by
// the real signing/delivery code on the CRM side.
// ---------------------------------------------------------------------------

describe("Step 3 — retry does not duplicate the mock side effect", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
  });

  function createN8nWorkflowSimulator(secret: string) {
    // Stands in for node 4's `n8n_crm_lead_created_dedupe` table: claim is
    // "insert if absent", exactly once per idempotency_key wins, mirroring
    // `insert ... on conflict (idempotency_key) do nothing returning ...`.
    const dedupeStore = new Set<string>();
    let sideEffectCalls = 0;

    const srv = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        const receivedSig = (req.headers["x-deskcomm-signature"] as string | undefined)?.toLowerCase();

        // Node 2 — verify signature (constant-time), matching the doc exactly.
        let valid = false;
        if (receivedSig) {
          const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
          const a = Buffer.from(expected, "hex");
          const b = Buffer.from(receivedSig, "hex");
          valid = a.length === b.length && timingSafeEqual(a, b);
        }

        // Node 3 — signature invalid: reject BEFORE touching the dedupe
        // store, exactly as the doc's branch ordering requires.
        if (!valid) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_signature" }));
          return;
        }

        const envelope = JSON.parse(rawBody) as N8nIntegrationEnvelope;

        // Node 4 — atomic claim (single-threaded Node callback here plays
        // the role of the Postgres `ON CONFLICT DO NOTHING` atomicity).
        const alreadyClaimed = dedupeStore.has(envelope.idempotency_key);
        if (!alreadyClaimed) dedupeStore.add(envelope.idempotency_key);

        // Node 5 — claimed (first delivery)?
        if (alreadyClaimed) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "duplicate_skipped" }));
          return;
        }

        // Node 6 — mock external side effect.
        sideEffectCalls += 1;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
      });
    });

    return {
      srv,
      get sideEffectCalls() {
        return sideEffectCalls;
      },
      get claimedKeys() {
        return new Set(dedupeStore);
      },
    };
  }

  it("two deliveries of the same event (retry) trigger the mock side effect exactly once", async () => {
    const secret = "reference-workflow-secret-16ch";
    const sim = createN8nWorkflowSimulator(secret);
    server = sim.srv;
    const { port, close } = await listen(server);

    const ctx = baseCtx();
    const config = {
      url: `http://127.0.0.1:${port}/hook`,
      workflow_key: "lead-created-mock-notify",
      secret,
    };

    const r1 = await executeN8nWebhook(ctx, config, { skipUrlCheck: true });
    const r2 = await executeN8nWebhook(ctx, config, { skipUrlCheck: true }); // retry, same event/rule

    expect(r1.status).toBe("success");
    expect(r2.status).toBe("success");
    expect(sim.sideEffectCalls, "mock side effect must fire exactly once across a retried delivery").toBe(1);
    expect(sim.claimedKeys.size).toBe(1);

    await close();
  });

  it("a DIFFERENT event through the same rule is not deduped against the first (dedupe key is per-event, not per-rule)", async () => {
    const secret = "reference-workflow-secret-16ch";
    const sim = createN8nWorkflowSimulator(secret);
    server = sim.srv;
    const { port, close } = await listen(server);

    const ctxA = baseCtx();
    const ctxB = baseCtx({ id: "9c1a2b3d-4e5f-4678-9abc-def012345678" });
    const config = {
      url: `http://127.0.0.1:${port}/hook`,
      workflow_key: "lead-created-mock-notify",
      secret,
    };

    const rA = await executeN8nWebhook(ctxA, config, { skipUrlCheck: true });
    const rB = await executeN8nWebhook(ctxB, config, { skipUrlCheck: true });

    expect(rA.status).toBe("success");
    expect(rB.status).toBe("success");
    expect(sim.sideEffectCalls).toBe(2);
    expect(sim.claimedKeys.size).toBe(2);

    await close();
  });

  it("an invalid signature is rejected before the dedupe store is touched and the mock side effect never fires", async () => {
    const receiverSecret = "receiver-side-secret-16-chars";
    const sim = createN8nWorkflowSimulator(receiverSecret);
    server = sim.srv;
    const { port, close } = await listen(server);

    const ctx = baseCtx();
    const config = {
      url: `http://127.0.0.1:${port}/hook`,
      workflow_key: "lead-created-mock-notify",
      // Sender signs with a DIFFERENT secret than the receiver expects —
      // simulates a forged/corrupted delivery.
      secret: "sender-side-secret-16-chars-x",
    };

    const result = await executeN8nWebhook(ctx, config, { skipUrlCheck: true, retryDelaysMs: [] });

    expect(result.status).toBe("failed"); // 401 is a non-2xx from the transport's point of view
    expect(sim.sideEffectCalls, "***REMOVED*** signature must never reach the side effect").toBe(0);
    expect(sim.claimedKeys.size, "***REMOVED*** signature must never claim an idempotency key").toBe(0);

    await close();
  });
});
