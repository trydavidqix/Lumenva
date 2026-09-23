"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { loadAuthUser } from "@/lib/auth/server";
import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase/server";

export async function signOut(): Promise<void> {
  // Get current user details for audit logs
  const user = await loadAuthUser();
  const hdrs = await headers();

  const store = await cookies();
  store.delete(FIREBASE_SESSION_COOKIE);
  store.delete("active_org");

  if (user) {
    await audit({
      action: "auth.logout",
      actorUserId: user.id,
      requestId: hdrs.get("x-request-id"),
      ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: hdrs.get("user-agent") ?? null,
    });
  }

  redirect("/login");
}
