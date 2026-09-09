import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptRuleActionSecrets, type RuleActionInput } from "./secrets";

function adminWithEncrypt(result: { data?: string | null; error?: { message: string } | null }) {
  return {
    rpc: vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
  } as unknown as SupabaseClient;
}

describe("encryptRuleActionSecrets", () => {
  it("call_webhook: config.secret vira config.secret_enc, plaintext removido", async () => {
    const admin = adminWithEncrypt({ data: "\\xdeadbeef", error: null });
    const actions: RuleActionInput[] = [
      { type: "call_webhook", config: { url: "https://x.com/h", secret: "shhh-secret-value" } },
    ];

    const out = await encryptRuleActionSecrets(admin, actions);

    expect(out).not.toBeNull();
    expect(out![0]!.config).toEqual({ url: "https://x.com/h", secret_enc: "deadbeef" });
    expect(JSON.stringify(out)).not.toContain("shhh-secret-value");
  });

  // C2 regression: the `else` branch used to hardcode `action.type === "call_webhook"`,
  // so ANY other action type (n8n_webhook included) had its plaintext `secret`
  // silently DROPPED instead of encrypted — the action executor
  // (lib/automation/actions/n8n-webhook.ts) then had no secret and no
  // secret_enc, so every n8n delivery went out unsigned with no error surfaced
  // anywhere. This is the primary regression guard for that fix.
  it("n8n_webhook: config.secret vira config.secret_enc, plaintext removido (C2 fix — antes era descartado em silêncio)", async () => {
    const admin = adminWithEncrypt({ data: "\\xcafef00d", error: null });
    const actions: RuleActionInput[] = [
      { type: "n8n_webhook", config: { url: "https://x.com/h", workflow_key: "wf-1", secret: "workflow-secret-value" } },
    ];

    const out = await encryptRuleActionSecrets(admin, actions);

    expect(out).not.toBeNull();
    expect(out![0]!.config).toEqual({ url: "https://x.com/h", workflow_key: "wf-1", secret_enc: "cafef00d" });
    expect(JSON.stringify(out)).not.toContain("workflow-secret-value");
  });

  it("n8n_webhook: secret_enc já presente (round-trip do editor) passa direto, sem re-chamar a cifra", async () => {
    const admin = adminWithEncrypt({ data: null, error: null });
    const actions: RuleActionInput[] = [
      { type: "n8n_webhook", config: { url: "https://x.com/h", workflow_key: "wf-1", secret_enc: "existingenc" } },
    ];

    const out = await encryptRuleActionSecrets(admin, actions);

    expect(out).not.toBeNull();
    expect(out![0]!.config).toEqual({ url: "https://x.com/h", workflow_key: "wf-1", secret_enc: "existingenc" });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("tipo sem secret bearing (ex.: add_tag): config passa sem alteração, sem chamar a cifra", async () => {
    const admin = adminWithEncrypt({ data: null, error: null });
    const actions: RuleActionInput[] = [{ type: "add_tag", config: { tags: ["vip"] } }];

    const out = await encryptRuleActionSecrets(admin, actions);

    expect(out).not.toBeNull();
    expect(out![0]!.config).toEqual({ tags: ["vip"] });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("cifra indisponível (RPC retorna null/erro): retorna null pro caller responder 422", async () => {
    const admin = adminWithEncrypt({ data: null, error: { message: "GUC ausente" } });
    const actions: RuleActionInput[] = [
      { type: "n8n_webhook", config: { url: "https://x.com/h", workflow_key: "wf-1", secret: "workflow-secret-value" } },
    ];

    const out = await encryptRuleActionSecrets(admin, actions);

    expect(out).toBeNull();
  });

  it("múltiplas ações mistas (call_webhook + n8n_webhook + add_tag) na mesma regra: cada uma tratada corretamente", async () => {
    const admin = adminWithEncrypt({ data: "\\xabc123", error: null });
    const actions: RuleActionInput[] = [
      { type: "call_webhook", config: { url: "https://a.com", secret: "secret-a-value" } },
      { type: "n8n_webhook", config: { url: "https://b.com", workflow_key: "wf-1", secret: "secret-b-value" } },
      { type: "add_tag", config: { tags: ["x"] } },
    ];

    const out = await encryptRuleActionSecrets(admin, actions);

    expect(out).not.toBeNull();
    expect(out![0]!.config).toEqual({ url: "https://a.com", secret_enc: "abc123" });
    expect(out![1]!.config).toEqual({ url: "https://b.com", workflow_key: "wf-1", secret_enc: "abc123" });
    expect(out![2]!.config).toEqual({ tags: ["x"] });
  });
});
