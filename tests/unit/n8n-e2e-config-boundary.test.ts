/**
 * AI Platform Phase 6 (n8n) — final-review fix round, finding I4.
 *
 * All existing n8n coverage injects rule configs in-memory: nothing proved an
 * operator could actually create a rule through the public API contract
 * (`createAutomationRuleSchema`, exactly what POST /api/v1/automation-rules
 * validates against) and have it flow, unmodified in shape, through
 * encryption, the real event_log consumer (`runAutomationForEvent`), and out
 * to an HMAC-signed HTTP delivery.
 *
 * This closes that gap end-to-end across the real boundary, composing the
 * actual production functions (never a reimplementation):
 *   1. lib/schemas/webhooks.ts — createAutomationRuleSchema (C1 fix: the
 *      discriminated union now has an n8n_webhook variant)
 *   2. lib/webhooks/secrets.ts — encryptRuleActionSecrets (C2 fix:
 *      n8n_webhook is now a SECRET_BEARING_TYPES member, so its secret is
 *      encrypted instead of silently dropped)
 *   3. lib/automation/engine.ts — runAutomationForEvent (the real event_log
 *      consumer dispatching automation_rules)
 *   4. lib/automation/actions/n8n-webhook.ts — executeN8nWebhook (I3 fix:
 *      gated on the "n8n" AI Platform feature, mocked "on" here since this
 *      suite is about the config boundary, not the gate)
 *
 * Only the Supabase admin client and the outbound fetch are stubbed/mocked —
 * everything else is the real call chain a production request would take.
 */
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agent-engine/platform/features", () => ({
  resolveAiPlatformFeature: vi.fn().mockResolvedValue({ mode: "on", config: {}, killed: false }),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { createAutomationRuleSchema } from "@/lib/schemas";
import { encryptRuleActionSecrets, type RuleActionInput } from "@/lib/webhooks/secrets";
import { runAutomationForEvent } from "@/lib/automation/engine";
import type { EventRow } from "@/lib/event-log/dispatcher";

const ORG_ID = "a6b20d3c-efe1-46a1-aa00-05685a11bef2";
const RULE_ID = "72f7d31c-aafb-41f7-855d-41cb909dc1ec";
const PIPELINE_ID = "bd88a08d-de84-4a52-8b80-0b4a73b5dcd2";
const STAGE_ID = "c1a2b3c4-d5e6-47f8-9a0b-1c2d3e4f5a6b";

/**
 * Reversible stand-in for the real `fn_encrypt_oauth`/`fn_decrypt_oauth`
 * pgp_sym RPCs (which need a live Postgres GUC key). Hex round-trip is enough
 * to prove the CALLER contract — secret goes out as secret_enc, comes back
 * decrypted to the exact same plaintext — without needing a real database.
 */
function fakeEncrypt(plaintext: string): string {
  return `\\x${Buffer.from(plaintext, "utf8").toString("hex")}`;
}
function fakeDecrypt(ciphertext: string): string {
  const hex = ciphertext.startsWith("\\x") ? ciphertext.slice(2) : ciphertext;
  return Buffer.from(hex, "hex").toString("utf8");
}

interface RuleActionsRow {
  type: string;
  config: Record<string, unknown>;
}

/** Minimal admin stub covering exactly the tables/RPCs this boundary touches. */
function makeAdmin(opts: { ruleActions: RuleActionsRow[]; runsInserted: Array<Record<string, unknown>> }) {
  return {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      if (fn === "fn_encrypt_oauth") return { data: fakeEncrypt(params.plaintext as string), error: null };
      if (fn === "fn_decrypt_oauth") return { data: fakeDecrypt(params.ciphertext as string), error: null };
      throw new Error(`n8n-e2e-config-boundary: rpc não coberto pelo stub: "${fn}"`);
    },
    from(table: string) {
      if (table === "automation_rules") {
        return {
          select: (cols: string) => {
            if (cols.includes("run_count")) {
              return { eq: () => ({ maybeSingle: async () => ({ data: { run_count: 0 }, error: null }) }) };
            }
            return {
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    order: async () => ({
                      data: [{ id: RULE_ID, name: "E2E n8n rule", conditions: [], actions: opts.ruleActions }],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          },
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === "automation_rule_runs") {
        return {
          insert: (row: Record<string, unknown>) => {
            opts.runsInserted.push(row);
            return { select: () => ({ maybeSingle: async () => ({ data: { id: "run-e2e-1" }, error: null }) }) };
          },
        };
      }
      if (table === "crm_leads") {
        // buildContext looks this up for entity_kind === "crm_lead"; no lead
        // found keeps context at {event: payload}, which is all this
        // boundary test needs (it isn't exercising lead/contact enrichment).
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
      }
      throw new Error(`n8n-e2e-config-boundary: tabela não coberta pelo stub: "${table}"`);
    },
  };
}

describe("n8n end-to-end config boundary: API schema -> encrypt -> engine -> real HMAC delivery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("regra n8n_webhook criada via createAutomationRuleSchema flui, sem reescrita manual, até uma entrega HMAC válida pelo motor real", async () => {
    // Registers the real n8n_webhook executor into the engine's action
    // registry (side-effect import, same precedent as every other n8n
    // engine test in this repo).
    await import("@/lib/automation/actions/register-all");

    // ------------------------------------------------------------------
    // 1) Create the rule exactly as an operator would via
    //    POST /api/v1/automation-rules — this IS what that route validates
    //    the request body against (C1 fix: n8n_webhook now has a variant).
    // ------------------------------------------------------------------
    const plaintextSecret = "***REMOVED***";
    const rawRule = {
      name: "Enviar lead novo pro n8n",
      trigger_event: "lead.created" as const,
      conditions: [],
      actions: [
        {
          type: "n8n_webhook" as const,
          config: {
            url: "https://n8n.example.com/webhook/wf-1",
            secret: plaintextSecret,
            workflow_key: "wf-1",
          },
        },
      ],
    };
    const parsed = createAutomationRuleSchema.safeParse(rawRule);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    // ------------------------------------------------------------------
    // 2) Encrypt secrets exactly as the route does before insert (C2 fix:
    //    n8n_webhook is now SECRET_BEARING — secret becomes secret_enc
    //    instead of being dropped).
    // ------------------------------------------------------------------
    const encryptAdmin = makeAdmin({ ruleActions: [], runsInserted: [] });
    const safeActions = await encryptRuleActionSecrets(encryptAdmin as never, parsed.data.actions as RuleActionInput[]);

    expect(safeActions).not.toBeNull();
    const storedAction = safeActions!.find((a) => a.type === "n8n_webhook")!;
    expect(storedAction.config?.secret_enc).toBeDefined();
    expect(storedAction.config?.secret).toBeUndefined();
    expect(JSON.stringify(safeActions)).not.toContain(plaintextSecret);

    // ------------------------------------------------------------------
    // 3) Inject the ENCRYPTED result (what would actually be persisted to
    //    automation_rules.actions jsonb) into the real engine, and trigger
    //    an event through the real dispatcher entrypoint.
    // ------------------------------------------------------------------
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200 } as Response);

    const runsInserted: Array<Record<string, unknown>> = [];
    const engineAdmin = makeAdmin({ ruleActions: safeActions as RuleActionsRow[], runsInserted });

    const eventRow: EventRow = {
      id: "evt-e2e-1",
      organization_id: ORG_ID,
      event_type: "lead.created",
      entity_kind: "crm_lead",
      entity_id: "lead-e2e-1",
      payload: { pipeline_id: PIPELINE_ID, stage_id: STAGE_ID, title: "Novo lead" },
      metadata: {},
      consumed_by: [],
      attempts: 0,
    };

    const result = await runAutomationForEvent(engineAdmin as never, eventRow);

    // ------------------------------------------------------------------
    // 4) Assert the webhook was actually called with a valid HMAC of the
    //    exact body sent, signed with the ORIGINAL plaintext secret (proves
    //    the round trip through encrypt -> persisted secret_enc -> decrypt
    //    at delivery time never mutates the secret).
    // ------------------------------------------------------------------
    expect(result.status).toBe("ok");
    expect(runsInserted).toHaveLength(1);
    const run = runsInserted[0]! as { status: string; actions_result: Array<{ status: string }> };
    expect(run.status).toBe("success");
    expect(run.actions_result[0]!.status).toBe("success");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0]! as [string, RequestInit];
    expect(calledUrl).toBe("https://n8n.example.com/webhook/wf-1");

    const headers = calledInit.headers as Record<string, string>;
    const body = calledInit.body as string;
    const expectedSig = createHmac("sha256", plaintextSecret).update(body).digest("hex");
    expect(headers["X-Deskcomm-Signature"]).toBe(expectedSig);

    const parsedBody = JSON.parse(body) as { data: Record<string, unknown> };
    expect(parsedBody.data.workflow_key).toBe("wf-1");
    // The secret itself never appears on the wire (only its HMAC does).
    expect(body).not.toContain(plaintextSecret);
  });
});
