import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function allowedOrigins(request: NextRequest): Set<string> {
  const origins = new Set([request.nextUrl.origin]);
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://localhost:3100");
  }
  return origins;
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (process.env.VERCEL_ENV === "preview") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  if (!request.nextUrl.pathname.startsWith("/api/")) return response;
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return response;

  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") {
    const blocked = NextResponse.json({ error: { message: "Origem não permitida." } }, { status: 403 });
    if (process.env.VERCEL_ENV === "preview") blocked.headers.set("X-Robots-Tag", "noindex, nofollow");
    return blocked;
  }

  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins(request).has(origin)) {
    const blocked = NextResponse.json({ error: { message: "Origem não permitida." } }, { status: 403 });
    if (process.env.VERCEL_ENV === "preview") blocked.headers.set("X-Robots-Tag", "noindex, nofollow");
    return blocked;
  }

  return response;
}

export const config = { matcher: ["/:path*"] };
