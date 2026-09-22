export const SUPABASE_COOKIE_NAME = "sb-lumenva-auth";
export const SUPABASE_COOKIE_NAME_LEGACY = "sb-deskcomm-auth";

function isCookieChunk(name: string, base: string) {
  return name === base || name.startsWith(`${base}_`);
}

export function normalizeSupabaseCookies<T extends { name: string }>(cookies: T[]): T[] {
  const hasNew = cookies.some(({ name }) => isCookieChunk(name, SUPABASE_COOKIE_NAME));
  if (hasNew) return cookies;

  return cookies.map((cookie) =>
    isCookieChunk(cookie.name, SUPABASE_COOKIE_NAME_LEGACY)
      ? { ...cookie, name: cookie.name.replace(SUPABASE_COOKIE_NAME_LEGACY, SUPABASE_COOKIE_NAME) }
      : cookie,
  );
}
