import { NextResponse, type NextRequest } from "next/server";
import { loadAuthUser } from "@/lib/auth/server";
import { ensureTenantForUser } from "@/lib/auth/provision";
import { audit } from "@/lib/audit";

/**
 * GET /auth/confirm — For Firebase, this route might receive an oobCode,
 * but F4 delegates all link processing to the client. This file remains
 * for compatibility or to handle post-signup provisioning if called manually.
 *
 * If a valid user session exists, it ensures tenant provisioning.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const requestId = request.headers.get("x-request-id");

  // Note: Firebase auth handles confirm links directly in the browser.
  // For tenant provisioning post-signup, we can check if the user is already authenticated.
  const user = await loadAuthUser();

  if (!user) {
    // If not authenticated, the client will need to handle the oobCode
    // Redirect to a client page if an oobCode is present, else login
    const oobCode = url.searchParams.get("oobCode");
    if (oobCode) {
      const loginUrl = new URL("/login", url.origin);
      loginUrl.searchParams.set("oobCode", oobCode);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  try {
    // Keep only the compatibility fields required by ensureTenantForUser.
    const stubUser = { id: user.id, email: user.email, app_metadata: {}, user_metadata: {} };
    await ensureTenantForUser(stubUser);
  } catch (e) {
    await audit({
      action: "auth.signup_provision_failed",
      actorUserId: user.id,
      metadata: { reason: e instanceof Error ? e.message : String(e) },
      requestId,
    });
    return NextResponse.redirect(new URL("/login?error=provisionamento", url.origin));
  }

  void audit({
    action: "auth.signup_confirmed",
    actorUserId: user.id,
    metadata: {},
    requestId,
  });

  return NextResponse.redirect(new URL("/onboarding/welcome", url.origin));
}
