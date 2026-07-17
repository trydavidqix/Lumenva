/**
 * Validação anti-SSRF de URL outbound. ponytail: bloqueio por literal de IP e
 * hostname; DNS-rebinding não coberto no v1 (upgrade: resolver DNS e validar
 * o IP resolvido antes do fetch).
 */
const PRIVATE_HOST_RX =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[::1\]|::1$)/i;

export function assertSafeOutboundUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("unsafe_url:invalid");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("unsafe_url:scheme");
  }
  if (parsed.protocol === "http:" && process.env.NODE_ENV === "production") {
    throw new Error("unsafe_url:https_required");
  }
  if (PRIVATE_HOST_RX.test(parsed.hostname)) {
    throw new Error("unsafe_url:private_host");
  }
}
