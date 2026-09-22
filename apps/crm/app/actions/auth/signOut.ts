"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { FIREBASE_SESSION_COOKIE, getSessionUid } from "@/lib/firebase/server";
import { audit } from "@/lib/audit";

export async function signOut(): Promise<void> {
  const uid = await getSessionUid();
  const hdrs = await headers();

  const store = await cookies();
  store.delete(FIREBASE_SESSION_COOKIE);
  store.delete("active_org");

  if (uid) {
    await audit({
      action: "auth.logout",
      actorUserId: uid,
      requestId: hdrs.get("x-request-id"),
      ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: hdrs.get("user-agent") ?? null,
    });
  }

  redirect("/login");
}
