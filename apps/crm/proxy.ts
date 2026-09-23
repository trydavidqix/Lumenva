import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { isPublicPath } from "@/lib/auth/public-paths";
import {
  verifyImpersonateCookieEdge,
  IMPERSONATE_COOKIE_NAME_EDGE,
} from "@/lib/impersonate/cookie-edge";

// Firebase Session Boundary (Middleware runs in Edge, no admin SDK allowed here).
// We rely on the presence of the cookie as a fast pass in Edge, and authoritative
// verification happens in server components / API handlers downstream.
const FIREBASE_SESSION_COOKIE = "fb-session-auth";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  // Inject X-Request-Id for downstream correlation (audit log, error wrappers).
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  response.headers.set("x-request-id", requestId);

  const { pathname, search } = request.nextUrl;
  // Expose pathname to Server Components via header (used by onboarding layout).
  response.headers.set("x-pathname", pathname);
  request.headers.set("x-pathname", pathname);

  // EPIC-11: in dev we route by path (`/admin/*`); in prod the
  // `admin.deskcomm.com` sub-domain is mapped via Vercel rewrites to the same
  // `/admin/*` paths. The host-based branch below stays a NOOP today and only
  // exists as documentation of the intended deploy topology.
  const host = request.headers.get("host") ?? "";
  const isAdminSurface = host.startsWith("admin.") || pathname.startsWith("/admin");

  if (isPublicPath(pathname)) {
    return response;
  }

  // Fast check: presence of cookie.
  const hasSession = request.cookies.has(FIREBASE_SESSION_COOKIE);

  if (!hasSession) {
    // API routes must respond with JSON envelope (contract: {error:{code,message}})
    // — never redirect HTML to JSON consumers. UI routes redirect to /login as before.
    if (pathname.startsWith("/api/")) {
      return new NextResponse(
        JSON.stringify({
          error: {
            code: "unauthenticated",
            message: "Authentication required",
          },
        }),
        {
          status: 401,
          headers: {
            "content-type": "application/json",
            "x-request-id": requestId,
          },
        },
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // EPIC-11 S-11.07: validate impersonate cookie on /app/* paths. Middleware
  // runs in Edge — no DB access, only HMAC + expiry. On any failure we delete
  // the cookie (defence-in-depth) and let the request continue (the layout
  // re-checks server-side; downstream code that depends on the cookie will
  // simply see no impersonation in effect).
  if (pathname.startsWith("/app")) {
    const impCookie = request.cookies.get(IMPERSONATE_COOKIE_NAME_EDGE)?.value;
    if (impCookie) {
      const result = await verifyImpersonateCookieEdge(
        impCookie,
        env.IMPERSONATE_COOKIE_SECRET ?? "",
      );
      if (!result.valid) {
        console.warn(
          `[middleware] impersonate cookie invalid (${result.reason ?? "unknown"}) — clearing`,
        );
        response.cookies.delete(IMPERSONATE_COOKIE_NAME_EDGE);
      }
    }
  }

  // /admin/* additionally requires platform_admin. In edge we bypass this check
  // and defer authoritative check to downstream server-side `requirePlatformAdmin`
  // since edge cannot run Firebase auth nor DB RPC.
  // Exception: if the route is /admin/forbidden, it's public. Wait, it's covered by isPublicPath.

  // Previous DB RPC `fn_is_platform_admin` is removed. Authoritative check MUST happen downstream.
  // The host-based branch below stays a NOOP today.

  return response;
}

export const config = {
  matcher: [
    // Run on all paths except Workflow SDK internals, static assets, and Next internals.
    "/((?!\\.well-known/workflow(?:/|$)|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
