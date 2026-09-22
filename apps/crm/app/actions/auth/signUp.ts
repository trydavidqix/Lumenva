"use server";

import { headers } from "next/headers";

import { signupSchema, type SignupInput } from "@/lib/auth/schemas";
import { audit, hashEmail } from "@/lib/audit";
import { authRateLimited, AUTH_LIMITS } from "@/lib/auth/rate-limit";
import { env } from "@/lib/env";

export type SignUpResult =
  | { ok: true }
  | {
      ok: false;
      error: "validation_error" | "rate_limited" | "signup_failed";
      details?: Record<string, unknown>;
    };

/**
 * Signup self-service: cria o usuário no GoTrue e dispara o e-mail de
 * confirmação. O tenant só é provisionado quando o link é confirmado em
 * /auth/confirm (evita orgs órfãs de cadastros nunca confirmados).
 *
 * Anti-enumeração: e-mail já cadastrado recebe a MESMA resposta de sucesso —
 * o GoTrue devolve um usuário ofuscado (identities vazio) sem erro, e nós não
 * diferenciamos. Rate limit de envio de e-mail é do próprio GoTrue.
 */
export async function signUp(input: SignupInput): Promise<SignUpResult> {
  const parsed = signupSchema.safeParse(input);
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

  if (await authRateLimited("signup", null, AUTH_LIMITS.signup)) {
    return { ok: false, error: "rate_limited" };
  }

  try {
    const { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } = await import("firebase/auth");
    const { auth } = await import("@/lib/firebase/client");

    const userCredential = await createUserWithEmailAndPassword(auth, parsed.data.email, parsed.data.password);
    
    // Armazenar o org_name no displayName temporariamente
    await updateProfile(userCredential.user, {
      displayName: parsed.data.org_name
    });

    await sendEmailVerification(userCredential.user, {
      url: `${origin}/auth/confirm`,
    });

    await audit({
      action: "auth.signup_requested",
      actorUserId: userCredential.user.uid,
      metadata: { email_hash: hashEmail(parsed.data.email) },
      requestId,
      ip,
      userAgent,
    });

    return { ok: true };
  } catch (error: any) {
    if (error?.code === "auth/email-already-in-use") {
      // Anti-enumeração: não devolver erro
      return { ok: true };
    }
    
    await audit({
      action: "auth.signup_failed",
      metadata: {
        email_hash: hashEmail(parsed.data.email),
        reason: error?.message ?? "unknown",
      },
      requestId,
      ip,
      userAgent,
    });
    return { ok: false, error: "signup_failed" };
  }
}
