import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySignature(rawBody: string | Uint8Array, signature: string | null | undefined, secret: string): boolean {
  if (!signature?.startsWith("sha256=") || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signature.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

export function verifyChallenge(mode: string | null, token: string | null, challenge: string | null, expectedToken: string): string | null {
  return mode === "subscribe" && token && challenge && expectedToken && token === expectedToken ? challenge : null;
}
