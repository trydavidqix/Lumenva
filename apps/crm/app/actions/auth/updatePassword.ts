"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/auth/schemas";
import { audit } from "@/lib/audit";

export type UpdatePasswordResult = {
  ok: false;
  error:
    | "validation_error"
    | "session_expired"
    | "same_password"
    | "update_failed"
    | "mfa_required"
    | "mfa_invalid";
  details?: Record<string, unknown>;
};

/**
 * Define a nova senha dentro da sessão de recovery (estabelecida pelo link do
 * e-mail via /auth/confirm). Ao concluir, encerra a sessão e redireciona para
 * /login?reset=success — o usuário prova a senha nova num login limpo.
 */
export async function updatePassword(
  input: ResetPasswordInput,
): Promise<UpdatePasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation_error",
      details: parsed.error.flatten().fieldErrors,
    };
  }

  const { getSessionUid, adminAuth, FIREBASE_SESSION_COOKIE } = await import("@/lib/firebase/server");
  const { cookies } = await import("next/headers");

  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: "session_expired" };

  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = hdrs.get("user-agent") ?? null;

  try {
    await adminAuth.updateUser(uid, { password: parsed.data.password });

    await audit({
      action: "auth.password_reset_completed",
      actorUserId: uid,
      metadata: {},
      requestId,
      ip,
      userAgent,
    });

    const store = await cookies();
    store.delete(FIREBASE_SESSION_COOKIE);
    redirect("/login?reset=success");
  } catch (error: any) {
    // If the new password is the same as the old password, Firebase might not error, or it might.
    // If we want to capture that, we can check error codes.
    await audit({
      action: "auth.password_reset_failed",
      actorUserId: uid,
      metadata: { reason: error?.message ?? "unknown" },
      requestId,
      ip,
      userAgent,
    });
    return { ok: false, error: "update_failed" };
  }
}
