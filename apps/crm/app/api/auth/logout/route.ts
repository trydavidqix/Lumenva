import { NextRequest, NextResponse } from "next/server";
import { getServerSession, revokeRefreshTokens, FIREBASE_SESSION_COOKIE } from "@/lib/firebase/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (session) {
      await revokeRefreshTokens(session.uid);
    }

    const cookieStore = await cookies();
    cookieStore.delete(FIREBASE_SESSION_COOKIE);

    return NextResponse.redirect(new URL("/login", request.url), {
      status: 302,
    });
  } catch (error) {
    console.error("Logout error:", error);
    const cookieStore = await cookies();
    cookieStore.delete(FIREBASE_SESSION_COOKIE);
    return NextResponse.redirect(new URL("/login", request.url), {
      status: 302,
    });
  }
}
