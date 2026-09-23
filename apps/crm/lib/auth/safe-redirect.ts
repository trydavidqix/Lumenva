const INTERNAL_ORIGIN = "https://lumenva.internal";
export const DEFAULT_AUTH_REDIRECT = "/app/inbox";

/**
 * Accept only an absolute path inside this application. Protocol-relative,
 * absolute, backslash-based, and malformed targets fall back safely.
 */
export function safeInternalRedirect(
  next: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT,
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(next, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
