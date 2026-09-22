import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { isPublicPath } from "@/lib/auth/public-paths";
import {
  verifyImpersonateCookieEdge,
  IMPERSONATE_COOKIE_NAME_EDGE,
} from "@/lib/impersonate/cookie-edge";

const FIREBASE_SESSION_COOKIE = "firebase_session";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  // Inject X-Request-Id for downstream correlation (audit log, error wrappers).
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  response.headers.set("x-request-id", requestId);

  const { pathname, search } = request.nextUrl;
  // Expose pathname to Server Components via header (used by onboarding layout).
  response.headers.set("x-pathname", pathname);
  request.headers.set("x-pathname", pathname);

  if (isPublicPath(pathname)) {
    return response;
  }

  const sessionCookie = request.cookies.get(FIREBASE_SESSION_COOKIE)?.value;

  if (!sessionCookie) {
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

  // Admin surface checking is deferred to downstream server components
  return response;
}

export const config = {
  matcher: [
    "/((?!\\.well-known/workflow(?:/|$)|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
