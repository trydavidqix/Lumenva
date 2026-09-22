"use server";

import { createSessionCookie, FIREBASE_SESSION_COOKIE } from "@/lib/firebase/server";
import { cookies } from "next/headers";

export async function signInWithGoogle(idToken: string) {
  const expiresIn = 60 * 60 * 24 * 5 * 1000;
  const sessionCookie = await createSessionCookie(idToken, expiresIn);
  const cookieStore = await cookies();
  
  cookieStore.set(FIREBASE_SESSION_COOKIE, sessionCookie, {
    maxAge: expiresIn / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
  });

  return { ok: true };
}