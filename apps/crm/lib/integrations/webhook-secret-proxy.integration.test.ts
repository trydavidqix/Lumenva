import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPostgresWebhookReplayStore, processWebhookOnce } from "./webhook-replay";
import { createPostgresSecretProxy } from "./secret-proxy";

const ORG = "00000000-0000-0000-0000-00000000000a";

function tableName(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

describe("Wave 11 durable webhook and Secret Proxy", () => {
  it("distinguishes in-progress work, completes once, and retries after handler failure", async () => {
    const url = process.env.WAVE11_DATABASE_URL;
    if (!url) return;
    const { Client } = await import("pg");
    const client = new Client({ connectionString: url });
    await client.connect();
    const table = tableName("wave11_replay");
    try {
      await client.query(`CREATE TABLE ${table}(
        organization_id uuid NOT NULL,
        provider text NOT NULL,
        event_id text NOT NULL,
        received_at timestamptz NOT NULL DEFAULT now(),
        status text NOT NULL DEFAULT 'PROCESSED' CHECK(status IN ('PROCESSING','PROCESSED','FAILED')),
        claim_token uuid,
        claimed_at timestamptz,
        completed_at timestamptz DEFAULT now(),
        PRIMARY KEY(organization_id,provider,event_id),
        CHECK(
          (status='PROCESSING' AND claim_token IS NOT NULL AND claimed_at IS NOT NULL AND completed_at IS NULL)
          OR (status='PROCESSED' AND claim_token IS NULL AND completed_at IS NOT NULL)
          OR (status='FAILED' AND claim_token IS NULL AND completed_at IS NULL)
        )
      )`);
      const db = { query: <T>(text: string, values?: unknown[]) => client.query<T>(text, values) };
      const store = createPostgresWebhookReplayStore(db, table);
      const input = { organizationId: ORG, provider: "fake", eventId: "evt-1" };

      let unblock!: () => void;
      let started!: () => void;
      const startedPromise = new Promise<void>((resolve) => { started = resolve; });
      const blocker = new Promise<void>((resolve) => { unblock = resolve; });
      const first = processWebhookOnce(store, input, async () => { started(); await blocker; });
      await startedPromise;
      await expect(processWebhookOnce(store, input, async () => { throw new Error("must_not_run"); })).resolves.toBe("in_progress");
      unblock();
      await expect(first).resolves.toBe("processed");
      await expect(processWebhookOnce(store, input, async () => { throw new Error("must_not_run"); })).resolves.toBe("duplicate");

      const retryInput = { ...input, eventId: "evt-retry" };
      await expect(processWebhookOnce(store, retryInput, async () => { throw new Error("handler_failed"); })).rejects.toThrow("handler_failed");
      await expect(processWebhookOnce(store, retryInput, async () => undefined)).resolves.toBe("processed");
    } finally {
      await client.query(`DROP TABLE IF EXISTS ${table}`);
      await client.end();
    }
  });

  it("Secret Proxy authorizes only the declared actor and operation", async () => {
    const url = process.env.WAVE11_DATABASE_URL;
    if (!url) return;
    const { Client } = await import("pg");
    const client = new Client({ connectionString: url });
    await client.connect();
    const table = tableName("wave11_secrets");
    try {
      await client.query(`CREATE TABLE ${table}(
        organization_id uuid NOT NULL,
        secret_ref text NOT NULL,
        secret_value text NOT NULL,
        allowed_operations text[] NOT NULL,
        allowed_actors text[] NOT NULL,
        revoked_at timestamptz,
        PRIMARY KEY(organization_id,secret_ref)
      )`);
      await client.query(`INSERT INTO ${table} VALUES($1,$2,$3,$4,$5,NULL)`, [ORG, "ref-1", "third-party-secret", ["send"], ["actor-1"]]);
      const proxy = createPostgresSecretProxy({ query: <T>(text: string, values?: unknown[]) => client.query<T>(text, values) }, table);
      await expect(proxy.withSecret({ organizationId: ORG, actorId: "actor-2" }, "ref-1", "send", async () => "x")).rejects.toThrow("secret_proxy_denied");
      await expect(proxy.withSecret({ organizationId: ORG, actorId: "actor-1" }, "ref-1", "read", async () => "x")).rejects.toThrow("secret_proxy_denied");
      await expect(proxy.withSecret({ organizationId: ORG, actorId: "actor-1" }, "ref-1", "send", async (secret) => secret)).resolves.toBe("third-party-secret");
    } finally {
      await client.query(`DROP TABLE IF EXISTS ${table}`);
      await client.end();
    }
  });
});
