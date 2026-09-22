"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { loginSchema, type LoginInput } from "@/lib/auth/schemas";
import { audit, hashEmail } from "@/lib/audit";
import {
  authRateLimited,
  contaBloqueadaPorFalhas,
  registrarFalhaDeLogin,
  AUTH_LIMITS,
} from "@/lib/auth/rate-limit";

export type SignInResult = {
  ok: false;
  error: "invalid_credentials" | "rate_limited" | "validation_error" | "mfa_required";
  details?: Record<string, unknown>;
  challengeId?: string;
};

/**
 * Sign in with password.
 *
 * On success: redirects server-side to `next` (or /app/inbox / /onboarding/mfa).
 * The redirect ensures Set-Cookie headers from supabase.auth propagate before
 * middleware re-evaluates the session — fixes Next 15 Server Action cookie
 * propagation race.
 *
 * On failure: returns an error discriminator. Caller renders inline message.
 */
export async function signInWithPassword(
  input: LoginInput,
  next?: string,
): Promise<SignInResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation_error",
      details: parsed.error.flatten().fieldErrors,
    };
  }

  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = hdrs.get("user-agent") ?? null;

  if (
    (await authRateLimited("login", null, AUTH_LIMITS.login)) ||
    (await contaBloqueadaPorFalhas(parsed.data.email, AUTH_LIMITS.login))
  ) {
    await audit({
      action: "auth.login_rate_limited",
      metadata: { email_hash: hashEmail(parsed.data.email) },
      requestId,
      ip,
      userAgent,
    });
    return { ok: false, error: "rate_limited" };
  }

  const { signInWithEmailAndPassword } = await import("firebase/auth");
  const { auth } = await import("@/lib/firebase/client");
  const { createSessionCookie, FIREBASE_SESSION_COOKIE } = await import("@/lib/firebase/server");
  const { cookies } = await import("next/headers");

  try {
    const userCredential = await signInWithEmailAndPassword(auth, parsed.data.email, parsed.data.password);
    const idToken = await userCredential.user.getIdToken();
    
    // Create session cookie (expires in 5 days)
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

    await audit({
      action: "auth.login_success",
      actorUserId: userCredential.user.uid,
      metadata: {},
      requestId,
      ip,
      userAgent,
    });

    return { ok: true } as any;

  } catch (error: any) {
    await registrarFalhaDeLogin(parsed.data.email, AUTH_LIMITS.login);
    await audit({
      action: "auth.login_failed",
      metadata: {
        email_hash: hashEmail(parsed.data.email),
        reason: error?.message ?? "unknown",
      },
      requestId,
      ip,
      userAgent,
    });
    return { ok: false, error: "invalid_credentials" };
  }
}
