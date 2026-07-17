import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { describe, it, expect, afterEach } from "vitest";
import { executeCallWebhook } from "@/lib/automation/actions/call-webhook";
import type { ActionCtx } from "@/lib/automation/types";

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
    context: { lead: { id: "lead-1", name: "Fulano" } },
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

describe("executeCallWebhook", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
  });

  it("sucesso: envia envelope correto, sem assinatura, sem organization_id", async () => {
    let received: { headers: Record<string, string | string[] | undefined>; body: string } | undefined;
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        received = { headers: req.headers, body: Buffer.concat(chunks).toString("utf8") };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    const { port, close } = await listen(server);

    const result = await executeCallWebhook(
      baseCtx(),
      { url: `http://127.0.0.1:${port}/hook` },
      { skipUrlCheck: true },
    );

    expect(result.status).toBe("success");
    expect(result.detail?.response_status).toBe(200);
    expect(received).toBeDefined();
    expect(received!.headers["x-deskcomm-event"]).toBe("lead.created");
    expect(received!.headers["x-deskcomm-signature"]).toBeUndefined();

    const parsedBody = JSON.parse(received!.body);
    expect(parsedBody.event).toBe("lead.created");
    expect(typeof parsedBody.occurred_at).toBe("string");
    expect(parsedBody.data).toEqual({ foo: "bar", lead: { id: "lead-1", name: "Fulano" } });
    expect(parsedBody.organization_id).toBeUndefined();
    expect(JSON.stringify(parsedBody)).not.toContain("org-1");

    await close();
  });

  it("com secret: header de assinatura HMAC-sha256 do body", async () => {
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

    const result = await executeCallWebhook(
      baseCtx(),
      { url: `http://127.0.0.1:${port}/hook`, secret: "s3cr3t" },
      { skipUrlCheck: true },
    );

    expect(result.status).toBe("success");
    const expectedSig = createHmac("sha256", "s3cr3t").update(received!.body).digest("hex");
    expect(received!.headers["x-deskcomm-signature"]).toBe(expectedSig);

    await close();
  });

  it("falha 500 persistente: 3 tentativas, retorna failed com response_status", async () => {
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

    const result = await executeCallWebhook(
      baseCtx(),
      { url: `http://127.0.0.1:${port}/hook` },
      { skipUrlCheck: true, retryDelaysMs: [1, 1] },
    );

    expect(hits).toBe(3);
    expect(result.status).toBe("failed");
    expect(result.detail?.response_status).toBe(500);

    await close();
  }, 15_000);

  it("falha depois sucesso: 500 na 1ª, 200 na 2ª — success com attempt=2", async () => {
    let hits = 0;
    server = createServer((req, res) => {
      hits += 1;
      const status = hits === 1 ? 500 : 200;
      req.resume();
      req.on("end", () => {
        res.writeHead(status);
        res.end("body");
      });
    });
    const { port, close } = await listen(server);

    const result = await executeCallWebhook(
      baseCtx(),
      { url: `http://127.0.0.1:${port}/hook` },
      { skipUrlCheck: true, retryDelaysMs: [1, 1] },
    );

    expect(hits).toBe(2);
    expect(result.status).toBe("success");
    expect(result.detail?.attempt).toBe(2);

    await close();
  }, 15_000);

  it("URL insegura (sem skipUrlCheck): failed com error unsafe_url", async () => {
    const result = await executeCallWebhook(baseCtx(), { url: "https://127.0.0.1:9/x" });
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/^unsafe_url/);
  });
});
