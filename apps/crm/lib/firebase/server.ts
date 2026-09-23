import { initFirebaseAuth } from "@lumenva/db/gcp/firebase-auth";
import { cookies } from "next/headers";

export const FIREBASE_SESSION_COOKIE = "fb-session-auth";
export const SESSION_EXPIRATION_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function createSessionCookie(idToken: string) {
  const auth = initFirebaseAuth();
  return auth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRATION_MS });
}

export async function verifySessionCookie(sessionCookie: string) {
  const auth = initFirebaseAuth();
  return auth.verifySessionCookie(sessionCookie, true);
}

export async function revokeRefreshTokens(uid: string) {
  const auth = initFirebaseAuth();
  return auth.revokeRefreshTokens(uid);
}

export async function getServerSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;

  if (!sessionCookie) return null;

  try {
    const decodedClaims = await verifySessionCookie(sessionCookie);
    return decodedClaims;
  } catch (error) {
    return null;
  }
}
