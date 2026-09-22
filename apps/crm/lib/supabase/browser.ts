import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_COOKIE_NAME } from "@/lib/supabase/cookie-compat";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (_client) return _client;

  const runtime = typeof window !== "undefined" ? window.__PUBLIC_ENV__ : undefined;
  const url = runtime?.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = runtime?.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("[supabase/browser] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes.");
  }

  _client = createBrowserClient(url, key, {
    cookieOptions: { name: SUPABASE_COOKIE_NAME, sameSite: "strict", path: "/" },
  });
  return _client;
}
