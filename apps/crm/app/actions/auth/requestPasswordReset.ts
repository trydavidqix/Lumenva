"use server";

import { headers } from "next/headers";

import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/auth/schemas";
import { audit, hashEmail } from "@/lib/audit";
import { authRateLimited, AUTH_LIMITS } from "@/lib/auth/rate-limit";
import { env } from "@/lib/env";

export type RequestPasswordResetResult =
  | { ok: true }
  | {
      ok: false;
      error: "validation_error" | "rate_limited" | "request_failed";
      details?: Record<string, unknown>;
    };

/**
 * Pede o e-mail de redefinição de senha. Resposta neutra quanto à existência
 * do e-mail (o GoTrue responde 200 para e-mail desconhecido — não vaza nada);
 * erros aqui são só de infra (SMTP, rate limit).
 */
export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<RequestPasswordResetResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation_error",
      details: parsed.error.flatten().fieldErrors,
    };
  }

  const hdrs = await headers();
  const origin = hdrs.get("origin") ?? env.NEXT_PUBLIC_APP_URL;
  const requestId = hdrs.get("x-request-id");
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = hdrs.get("user-agent") ?? null;

  if (await authRateLimited("reset", parsed.data.email, AUTH_LIMITS.reset)) {
    return { ok: false, error: "rate_limited" };
  }

  try {
    const { sendPasswordResetEmail } = await import("firebase/auth");
    const { auth } = await import("@/lib/firebase/client");
    
    await sendPasswordResetEmail(auth, parsed.data.email, {
      url: `${origin}/login?reset=success`,
    });

    await audit({
      action: "auth.password_reset_requested",
      metadata: { email_hash: hashEmail(parsed.data.email) },
      requestId,
      ip,
      userAgent,
    });

    return { ok: true };
  } catch (error: any) {
    await audit({
      action: "auth.password_reset_request_failed",
      metadata: {
        email_hash: hashEmail(parsed.data.email),
        reason: error?.message ?? "unknown",
      },
      requestId,
      ip,
      userAgent,
    });
    return { ok: false, error: "request_failed" };
  }
}
