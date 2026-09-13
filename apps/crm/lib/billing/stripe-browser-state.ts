import { createHmac, timingSafeEqual } from "node:crypto";

export type CheckoutStatePayload = { readonly organizationId: string; readonly planSlug: string; readonly nonce: string; readonly issuedAtUnix: number };
export type CheckoutStateStore = { has(nonce: string): boolean; add(nonce: string): void };

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

export function consumeCheckoutState(
  state: string | null | undefined,
  expected: { organizationId: string; planSlug: string; nowUnix: number; maxAgeSeconds: number; secret: string; store: CheckoutStateStore },
): boolean {
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
  if (expected.store.has(payload.nonce)) return false;
  expected.store.add(payload.nonce);
  return true;
}
