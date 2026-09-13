import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type CheckoutStatePayload = { readonly organizationId: string; readonly planSlug: string; readonly nonce: string; readonly issuedAtUnix: number };
export type CheckoutStateDb = {
  from(table: "idempotency_keys"): {
    insert(values: { organization_id: string; key: string; endpoint: string; request_hash: string; response_body: Record<string, never>; status_code: number; expires_at: string }): PromiseLike<{ error: { code?: string; message?: string } | null }>;
  };
};
export type CheckoutStateStore = { claim(organizationId: string, nonce: string, nowUnix: number, ttlSeconds: number): Promise<boolean> };

const ENDPOINT = "stripe_checkout_state";

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createCheckoutState(payload: CheckoutStatePayload, secret: string): string {
  if (!secret || !payload.organizationId || !payload.planSlug || !payload.nonce || !Number.isSafeInteger(payload.issuedAtUnix)) throw new Error("invalid_checkout_state");
  const encoded = encode(payload);
  return `${encoded}.${sign(encoded, secret)}`;
}

export function createPostgresCheckoutStateStore(db: CheckoutStateDb): CheckoutStateStore {
  return {
    async claim(organizationId, nonce, nowUnix, ttlSeconds) {
      const { error } = await db.from("idempotency_keys").insert({
        organization_id: organizationId,
        key: nonce,
        endpoint: ENDPOINT,
        request_hash: createHash("sha256").update(`${organizationId}:${nonce}`).digest("hex"),
        response_body: {},
        status_code: 0,
        expires_at: new Date((nowUnix + ttlSeconds) * 1000).toISOString(),
      });
      if (!error) return true;
      if (error.code === "23505") return false;
      throw new Error(error.message ?? "checkout state reservation failed");
    },
  };
}

export async function consumeCheckoutState(
  state: string | null | undefined,
  expected: { organizationId: string; planSlug: string; nowUnix: number; maxAgeSeconds: number; secret: string; store: CheckoutStateStore },
): Promise<boolean> {
  if (!state || !expected.secret) return false;
  const [encoded, signature, extra] = state.split(".");
  if (!encoded || !signature || extra) return false;
  const expectedSignature = sign(encoded, expected.secret);
  const actualBytes = Buffer.from(signature, "base64url");
  const expectedBytes = Buffer.from(expectedSignature, "base64url");
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return false;
  let payload: Partial<CheckoutStatePayload>;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<CheckoutStatePayload>;
  } catch {
    return false;
  }
  const issuedAtUnix = payload.issuedAtUnix;
  if (payload.organizationId !== expected.organizationId || payload.planSlug !== expected.planSlug || typeof payload.nonce !== "string" || typeof issuedAtUnix !== "number" || !Number.isSafeInteger(issuedAtUnix)) return false;
  if (expected.nowUnix < issuedAtUnix || expected.nowUnix - issuedAtUnix > expected.maxAgeSeconds) return false;
  return expected.store.claim(expected.organizationId, payload.nonce, expected.nowUnix, expected.maxAgeSeconds);
}
