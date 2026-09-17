import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import type { ActionCtx } from "@/lib/automation/types";

// I3 fix: executeN8nWebhook now gates on the "n8n" AI Platform feature
// (lib/agent-engine/platform/features.ts) before doing anything else. Every
// test in this file exercises delivery behavior, not the gate itself, so the
// feature defaults to "on"/not-killed here — the gate's own behavior (off,
// killed) is covered by the dedicated describe block below. Mirrors the
// vi.hoisted + vi.mock pattern used by
// lib/agent-engine/obs/external-tracing-config.test.ts for the same seam.
const state = vi.hoisted(() => ({
  resolveFeature: vi.fn().mockResolvedValue({ mode: "on", config: {}, killed: false }),
}));
vi.mock("@/lib/agent-engine/platform/features", () => ({
  resolveAiPlatformFeature: state.resolveFeature,
}));

import { executeN8nWebhook, n8nWebhookConfigSchema } from "@/lib/automation/actions/n8n-webhook";

function baseCtx(overrides: Partial<ActionCtx["event"]> = {}): ActionCtx {
  return {
    admin: {} as ActionCtx["admin"],
    organizationId: "org-1",
    ruleId: "rule-1",
    requestId: "req-1",
    event: {
      id: "evt-1",
      organization_id: "org-1",
      event_type: "lead.created",
      entity_kind: "crm_lead",
      entity_id: "lead-1",
      payload: { foo: "bar" },
      metadata: {},
      consumed_by: [],
      attempts: 0,
      ...overrides,
    },
    context: { lead: { id: "lead-1", title: "Fulano" } },
  };
}

/** Admin stub que só responde a fn_decrypt_oauth — o único RPC que o path secret_enc chama. */
function adminWithDecrypt(result: { data?: string | null; error?: { message: string } | null }): ActionCtx["admin"] {
  return {
    rpc: async () => ({ data: result.data ?? null, error: result.error ?? null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
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

describe("executeN8nWebhook", () => {
  let server: Server | undefined;

  beforeEach(() => {
    state.resolveFeature.mockClear();
    state.resolveFeature.mockResolvedValue({ mode: "on", config: {}, killed: false });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
  });

  it("n8nWebhookConfigSchema aceita url/workflow_key + secret OU secret_enc, rejeita chaves desconhecidas", () => {
    expect(n8nWebhookConfigSchema.safeParse({ url: "https://x.com/h", workflow_key: "wf-1" }).success).toBe(true);
    expect(
      n8nWebhookConfigSchema.safeParse({ url: "https://x.com/h", workflow_key: "wf-1", secret: "***REMOVED***" })
        .success,
    ).toBe(true);
    expect(
      n8nWebhookConfigSchema.safeParse({ url: "https://x.com/h", workflow_key: "wf-1", secret_enc: "deadbeef" })
        .success,
    ).toBe(true);
    expect(
      n8nWebhookConfigSchema.safeParse({ url: "https://x.com/h", workflow_key: "wf-1", extra: "nope" }).success,
    ).toBe(false);
  });

  it("config inválida (workflow_key ausente): failed com error invalid_config, sem tentar entrega", async () => {
    const result = await executeN8nWebhook(baseCtx(), { url: "https://example.com/hook" });
    expect(result).toEqual({ type: "n8n_webhook", status: "failed", error: "invalid_config" });
  });

  it("URL privada/localhost: barrada pelo guard anti-SSRF existente (assertSafeOutboundUrl), sem skipUrlCheck", async () => {
    const result = await executeN8nWebhook(baseCtx(), {
      url: "https://127.0.0.1:9/hook",
      workflow_key: "wf-1",
    });
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/^unsafe_url/);
  });

  describe("http rejeitado em produção", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("scheme http com host público: failed unsafe_url:https_required", async () => {
      const result = await executeN8nWebhook(baseCtx(), {
        url: "http://example.com/hook",
        workflow_key: "wf-1",
      });
      expect(result.status).toBe("failed");
      expect(result.error).toBe("unsafe_url:https_required");
    });
  });

  it("envelope assinado pelo caminho canônico: X-Deskcomm-Signature é HMAC-sha256 do body exatamente enviado", async () => {
    let received: { headers: Record<string, string | string[] | undefined>; body: string } | undefined;
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        received = { headers: req.headers, body: Buffer.concat(chunks).toString("utf8") };
        res.writeHead(200);
        res.end("ok");
      });
    });
    const { port, close } = await listen(server);

    const secret = "n8n-workflow-secret-16chars";
    const result = await executeN8nWebhook(
      baseCtx(),
      { url: `http://127.0.0.1:${port}/hook`, workflow_key: "wf-1", secret },
      { skipUrlCheck: true },
    );

    expect(result.status).toBe("success");
    const expectedSig = createHmac("sha256", secret).update(received!.body).digest("hex");
    expect(received!.headers["x-lumenva-signature"]).toBe(expectedSig);
    expect(received!.headers["x-deskcomm-signature"]).toBe(expectedSig);

    const parsedBody = JSON.parse(received!.body);
    expect(parsedBody.event_type).toBe("lead.created");
    expect(parsedBody.data.workflow_key).toBe("wf-1");

    await close();
  });

  it("sem secret: nenhuma assinatura é enviada", async () => {
    let received: { headers: Record<string, string | string[] | undefined> } | undefined;
    server = createServer((req, res) => {
      req.resume();
      req.on("end", () => {
        received = { headers: req.headers };
        res.writeHead(200);
        res.end("ok");
      });
    });
    const { port, close } = await listen(server);

    const result = await executeN8nWebhook(
      baseCtx(),
      { url: `http://127.0.0.1:${port}/hook`, workflow_key: "wf-1" },
      { skipUrlCheck: true },
    );

    expect(result.status).toBe("success");
    expect(received!.headers["x-lumenva-signature"]).toBeUndefined();
    expect(received!.headers["x-deskcomm-signature"]).toBeUndefined();

    await close();
  });

  it("secret_enc: decrypt bem-sucedido assina com o secret decifrado (precedência sobre plaintext)", async () => {
    let received: { headers: Record<string, string | string[] | undefined>; body: string } | undefined;
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        received = { headers: req.headers, body: Buffer.concat(chunks).toString("utf8") };
        res.writeHead(200);
        res.end("ok");
      });
    });
    const { port, close } = await listen(server);

    const decryptedSecret = "decrypted-secret-value";
    const ctx = baseCtx();
    ctx.admin = adminWithDecrypt({ data: decryptedSecret, error: null });

    const result = await executeN8nWebhook(
      ctx,
      {
        url: `http://127.0.0.1:${port}/hook`,
        workflow_key: "wf-1",
        secret: "plaintext-should-be-overridden-16", // deve ser ignorado — secret_enc vence
        secret_enc: "deadbeef",
      },
      { skipUrlCheck: true },
    );

    expect(result.status).toBe("success");
    const expectedSig = createHmac("sha256", decryptedSecret).update(received!.body).digest("hex");
    expect(received!.headers["x-lumenva-signature"]).toBe(expectedSig);
    expect(received!.headers["x-deskcomm-signature"]).toBe(expectedSig);
    expect(received!.body).not.toContain("plaintext-should-be-overridden-16");

    await close();
  });

  it("secret_enc: decrypt indisponível (chave da GUC ausente) — envia SEM assinatura, não falha a entrega", async () => {
    let received: { headers: Record<string, string | string[] | undefined> } | undefined;
    server = createServer((req, res) => {
      req.resume();
      req.on("end", () => {
        received = { headers: req.headers };
        res.writeHead(200);
        res.end("ok");
      });
    });
    const { port, close } = await listen(server);

    const ctx = baseCtx();
    ctx.admin = adminWithDecrypt({ data: null, error: { message: "guc missing" } });

    const result = await executeN8nWebhook(
      ctx,
      { url: `http://127.0.0.1:${port}/hook`, workflow_key: "wf-1", secret_enc: "deadbeef" },
      { skipUrlCheck: true },
    );

    expect(result.status).toBe("success");
    expect(received!.headers["x-deskcomm-signature"]).toBeUndefined();

    await close();
  });

  it("2xx sucesso é registrado uma única vez (uma tentativa, um hit no servidor)", async () => {
    let hits = 0;
    server = createServer((req, res) => {
      hits += 1;
      req.resume();
      req.on("end", () => {
        res.writeHead(200);
        res.end("ok");
      });
    });
    const { port, close } = await listen(server);

    const result = await executeN8nWebhook(
      baseCtx(),
      { url: `http://127.0.0.1:${port}/hook`, workflow_key: "wf-1" },
      { skipUrlCheck: true },
    );

    expect(hits).toBe(1);
    expect(result.status).toBe("success");
    expect(result.detail?.attempt).toBe(1);

    await close();
  });

  it("500 persistente: resultado de entrega retryable (failed, todas as tentativas contabilizadas)", async () => {
    let hits = 0;
    server = createServer((req, res) => {
      hits += 1;
      req.resume();
      req.on("end", () => {
        res.writeHead(500);
        res.end("nope");
      });
    });
    const { port, close } = await listen(server);

    const result = await executeN8nWebhook(
      baseCtx(),
      { url: `http://127.0.0.1:${port}/hook`, workflow_key: "wf-1" },
      { skipUrlCheck: true, retryDelaysMs: [1, 1] },
    );

    expect(hits).toBe(3);
    expect(result.status).toBe("failed");
    expect(result.detail?.response_status).toBe(500);

    await close();
  }, 15_000);

  it("falha de rede (timeout-like, mesmo branch de catch do transporte): resultado failed, mesma classificação de retry", async () => {
    // Porta sem listener: connection refused cai no mesmo catch que um
    // AbortError de timeout — deliverSignedWebhook trata os dois igual
    // (retry até esgotar retryDelaysMs), então isso exercita a mesma
    // classificação sem esperar os 10s reais de TIMEOUT_MS.
    const result = await executeN8nWebhook(
      baseCtx(),
      { url: "http://127.0.0.1:9/hook", workflow_key: "wf-1" },
      { skipUrlCheck: true, retryDelaysMs: [1, 1] },
    );

    expect(result.status).toBe("failed");
    expect(result.detail?.attempts).toBe(3);
  }, 15_000);

  it("evento/idempotency duplicado (mesma regra + mesmo evento) não inventa uma key nova", async () => {
    const bodies: string[] = [];
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        bodies.push(Buffer.concat(chunks).toString("utf8"));
        res.writeHead(200);
        res.end("ok");
      });
    });
    const { port, close } = await listen(server);

    const config = { url: `http://127.0.0.1:${port}/hook`, workflow_key: "wf-1" };
    const r1 = await executeN8nWebhook(baseCtx(), config, { skipUrlCheck: true });
    const r2 = await executeN8nWebhook(baseCtx(), config, { skipUrlCheck: true });

    expect(r1.status).toBe("success");
    expect(r2.status).toBe("success");
    expect(bodies).toHaveLength(2);
    const key1 = JSON.parse(bodies[0]!).idempotency_key;
    const key2 = JSON.parse(bodies[1]!).idempotency_key;
    expect(key1).toBe(key2);
    expect(typeof key1).toBe("string");
    expect(key1.length).toBeGreaterThan(0);

    await close();
  });

  it("workflow secret nunca aparece no resultado da ação nem no body enviado", async () => {
    let received: { body: string } | undefined;
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        received = { body: Buffer.concat(chunks).toString("utf8") };
        res.writeHead(200);
        res.end("ok");
      });
    });
    const { port, close } = await listen(server);

    const secret = "workflow-secret-must-not-leak-16";
    const result = await executeN8nWebhook(
      baseCtx(),
      { url: `http://127.0.0.1:${port}/hook`, workflow_key: "wf-1", secret },
      { skipUrlCheck: true },
    );

    expect(JSON.stringify(result)).not.toContain(secret);
    expect(received!.body).not.toContain(secret);

    await close();
  });

  it("wiring: register-all.ts registra n8n_webhook no registry do motor", async () => {
    await import("@/lib/automation/actions/register-all");
    const { getAction } = await import("@/lib/automation/actions");
    expect(getAction("n8n_webhook")).toBeDefined();
  });

  describe("I3: gate na feature AI Platform 'n8n' (default off)", () => {
    it("feature mode 'off': failed n8n_feature_disabled, sem tentar entrega/fetch nem checar a URL", async () => {
      state.resolveFeature.mockResolvedValue({ mode: "off", config: {}, killed: false });

      // URL deliberadamente inválida/unsafe — se o gate não interceptasse
      // antes do parse/fetch, este teste falharia por outro motivo (unsafe_url
      // ou invalid_config) em vez de provar que a entrega nem começou.
      const result = await executeN8nWebhook(baseCtx(), { url: "not a url", workflow_key: "wf-1" });

      expect(result).toEqual({ type: "n8n_webhook", status: "failed", error: "n8n_feature_disabled" });
      expect(state.resolveFeature).toHaveBeenCalledWith({ organizationId: "org-1", feature: "n8n" });
    });

    it("kill switch ativo (killed=true): failed n8n_feature_disabled mesmo se mode viesse 'on'", async () => {
      // resolveAiPlatformFeature real já colapsa mode->'off' quando killed=true;
      // este teste garante que executeN8nWebhook honra `killed` diretamente
      // também, sem depender só do valor de `mode`.
      state.resolveFeature.mockResolvedValue({ mode: "on", config: {}, killed: true });

      const result = await executeN8nWebhook(baseCtx(), { url: "https://example.com/hook", workflow_key: "wf-1" });

      expect(result).toEqual({ type: "n8n_webhook", status: "failed", error: "n8n_feature_disabled" });
    });

    it.each(["shadow", "canary", "on"] as const)(
      "feature mode '%s' (não-off, não killed): entrega prossegue normalmente",
      async (mode) => {
        state.resolveFeature.mockResolvedValue({ mode, config: {}, killed: false });
        server = createServer((req, res) => {
          req.resume();
          req.on("end", () => {
            res.writeHead(200);
            res.end("ok");
          });
        });
        const { port, close } = await listen(server);

        const result = await executeN8nWebhook(
          baseCtx(),
          { url: `http://127.0.0.1:${port}/hook`, workflow_key: "wf-1" },
          { skipUrlCheck: true },
        );

        expect(result.status).toBe("success");
        await close();
      },
    );

    it("organizationId propagado ao gate vem de ctx.organizationId, não de config/payload", async () => {
      state.resolveFeature.mockResolvedValue({ mode: "off", config: {}, killed: false });
      const ctx = baseCtx();
      ctx.organizationId = "org-specific-tenant";

      await executeN8nWebhook(ctx, { url: "https://example.com/hook", workflow_key: "wf-1" });

      expect(state.resolveFeature).toHaveBeenCalledWith({ organizationId: "org-specific-tenant", feature: "n8n" });
    });
  });
});
