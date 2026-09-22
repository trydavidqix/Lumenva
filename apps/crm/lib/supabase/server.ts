import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookieSecure } from "@/lib/supabase/cookie-secure";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { normalizeSupabaseCookies, SUPABASE_COOKIE_NAME } from "@/lib/supabase/cookie-compat";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return normalizeSupabaseCookies(cookieStore.getAll());
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies; middleware refreshes the session.
        }
      },
    },
    cookieOptions: {
      name: SUPABASE_COOKIE_NAME,
      sameSite: "strict",
      httpOnly: true,
      secure: cookieSecure(),
      path: "/",
    },
  });
}
