import { NextResponse, type NextRequest } from "next/server";
import { ensureTenantForUser } from "@/lib/auth/provision";
import { audit } from "@/lib/audit";
import { adminAuth } from "@/lib/firebase/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const oobCode = url.searchParams.get("oobCode");
  const mode = url.searchParams.get("mode"); // 'verifyEmail' or 'resetPassword'
  const requestId = request.headers.get("x-request-id");

  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  if (!oobCode || !mode) {
    return redirectTo("/login?error=link_invalido");
  }

  try {
    const { applyActionCode, verifyPasswordResetCode } = await import("firebase/auth");
    const { auth } = await import("@/lib/firebase/client");

    if (mode === "resetPassword") {
      // Just verify the code is valid; the user will reset it on the next screen.
      // We pass the oobCode to the reset screen so they can use it to actually set the new password.
      const email = await verifyPasswordResetCode(auth, oobCode);
      return redirectTo(`/login/reset?oobCode=${oobCode}&email=${encodeURIComponent(email)}`);
    }

    if (mode === "verifyEmail") {
      await applyActionCode(auth, oobCode);
      // We need to know who the user is to provision the tenant.
      // Wait, applyActionCode doesn't return the user. We must figure out who just verified.
      // However, Firebase doesn't make it easy to get the UID from just the oobCode in Node.
      // So let's redirect them to a client-side page that finishes provisioning or just tell them to log in.
      // Since they just verified, they can log in.
      return redirectTo("/login?verified=true");
    }

    return redirectTo("/login?error=link_invalido");

  } catch (error: any) {
    await audit({
      action: "auth.email_link_rejected",
      metadata: { mode, reason: error?.message ?? "unknown" },
      requestId,
    });
    return redirectTo("/login?error=link_invalido");
  }
}
