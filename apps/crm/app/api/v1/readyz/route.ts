import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Lightweight process readiness probe; dependencies are checked by /health. */
export function GET(): Response {
  return NextResponse.json({ status: "ready", version: process.env.npm_package_version ?? "unknown" }, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}
