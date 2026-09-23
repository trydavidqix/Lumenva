"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import { audit } from "@/lib/audit";
import { loadAuthUser } from "@/lib/auth/server";
import { getServerSession, revokeRefreshTokens, FIREBASE_SESSION_COOKIE } from "@/lib/firebase/server";

export async function signOutEverywhere(): Promise<void> {
  const session = await getServerSession();
  const user = await loadAuthUser();
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  if (session?.uid) {
    await revokeRefreshTokens(session.uid);
  }

  const store = await cookies();
  store.delete(FIREBASE_SESSION_COOKIE);
  store.delete("active_org");

  if (user) {
    await audit({
      action: "auth.logout",
      actorUserId: user.id,
      requestId,
      metadata: { scope: "global" },
    });
  }
  redirect("/login");
}
