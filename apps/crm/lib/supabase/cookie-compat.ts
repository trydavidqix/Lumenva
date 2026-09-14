export const SUPABASE_COOKIE_NAME = "sb-lumenva-auth";

/** Mantém a superfície de normalização canônica sem aliases de identidade antigos. */
export function normalizeSupabaseCookies<T extends { name: string }>(cookies: T[]): T[] {
  return cookies;
}
