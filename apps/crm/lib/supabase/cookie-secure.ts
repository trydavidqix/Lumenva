import { env } from "@/lib/env";

export function cookieSecure(): boolean {
  return env.NEXT_PUBLIC_APP_URL.startsWith("https://");
}
