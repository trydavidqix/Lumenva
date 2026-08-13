"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { AUTH_LIMITS, contaBloqueadaPorFalhas, registrarFalhaDeLogin } from "@/lib/auth/rate-limit";

export type VerifyMfaResult =
  | { ok: false; error: "mfa_invalid" }
  | { ok: false; error: "mfa_locked"; retry_in_seconds: number };

/**
 * Verifies a TOTP code against the user's verified factor and (on success)
 * elevates the session to AAL2. On failure, increments a server-side
 * (Upstash-backed) attempt counter keyed by user id. After 3 failures within
 * 60s, the user is locked out and must wait.
 *
 * The lockout counter is server-side by design: a client-writable cookie is
 * not a security boundary — an attacker holding a valid AAL1 session (e.g.
 * from a leaked password) could simply omit the cookie on each request and
 * reset the counter every time.
 */
export async function verifyMfa(code: string, next?: string): Promise<VerifyMfaResult> {
  const supabase = await createClient();
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = hdrs.get("user-agent") ?? null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Sanity-check: must have a verified TOTP factor.
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const totp = factorsData?.totp?.find((f) => f.status === "verified");
  if (!totp) redirect("/app/inbox");

  if (await contaBloqueadaPorFalhas(user.id, AUTH_LIMITS.mfa)) {
    return { ok: false, error: "mfa_locked", retry_in_seconds: AUTH_LIMITS.mfa.windowSec };
  }

  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "mfa_invalid" };
  }

  // Issue challenge + verify.
  const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
    factorId: totp.id,
  });
  if (challengeErr || !challenge) {
    return { ok: false, error: "mfa_invalid" };
  }

  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code,
  });

  if (verifyErr) {
    await registrarFalhaDeLogin(user.id, AUTH_LIMITS.mfa);
    const locked = await contaBloqueadaPorFalhas(user.id, AUTH_LIMITS.mfa);
    await audit({
      action: "auth.mfa_failed",
      actorUserId: user.id,
      metadata: { locked },
      requestId,
      ip,
      userAgent,
    });
    if (locked) {
      return { ok: false, error: "mfa_locked", retry_in_seconds: AUTH_LIMITS.mfa.windowSec };
    }
    return { ok: false, error: "mfa_invalid" };
  }

  await audit({
    action: "auth.mfa_success",
    actorUserId: user.id,
    metadata: {},
    requestId,
    ip,
    userAgent,
  });

  redirect(next || "/app/inbox");
}
