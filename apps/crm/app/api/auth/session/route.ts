import { NextRequest, NextResponse } from "next/server";
import { initFirebaseAuth } from "@lumenva/db/gcp/firebase-auth";
import { createSessionCookie, FIREBASE_SESSION_COOKIE, SESSION_EXPIRATION_MS } from "@/lib/firebase/server";
import { cookies } from "next/headers";
import { cookieSecure } from "@/lib/supabase/cookie-secure";

export async function POST(request: NextRequest) {
  try {
    // CSRF Protection Check: Verify a custom header or Content-Type
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: { code: "unauthorized", message: "CSRF token missing" } }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ error: { code: "invalid_request", message: "Missing idToken" } }, { status: 400 });
    }

    const auth = initFirebaseAuth();
    const decodedIdToken = await auth.verifyIdToken(idToken);

    // Enforce recent auth_time (e.g., within the last 5 minutes)
    if (new Date().getTime() / 1000 - decodedIdToken.auth_time > 5 * 60) {
      return NextResponse.json({ error: { code: "unauthorized", message: "Recent sign in required" } }, { status: 401 });
    }

    const sessionCookie = await createSessionCookie(idToken);

    const cookieStore = await cookies();
    cookieStore.set(FIREBASE_SESSION_COOKIE, sessionCookie, {
      maxAge: SESSION_EXPIRATION_MS / 1000, // seconds
      httpOnly: true,
      secure: cookieSecure(),
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json({ error: { code: "unauthorized", message: "Session creation failed" } }, { status: 401 });
  }
}
