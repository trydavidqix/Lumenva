import { NextResponse } from "next/server";
import { parseContactRequest } from "@/lib/contact-form";
import { limitContactRequest } from "@/lib/contact-rate-limit";
import { sendContactEmails } from "@/lib/resend";

export const runtime = "nodejs";
export const maxDuration = 10;

function isAllowedRequest(request: Request): boolean {
  const requestUrl = new URL(request.url);
  const allowedOrigins = new Set([requestUrl.origin]);
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.add("http://localhost:3000");
    allowedOrigins.add("http://localhost:3100");
  }

  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) return false;

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (!allowedOrigins.has(new URL(referer).origin)) return false;
    } catch {
      return false;
    }
  }

  return true;
}

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedRequest(request)) {
    return NextResponse.json({ error: { message: "Origem não permitida." } }, { status: 403 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Dados inválidos." } }, { status: 400 });
  }

  const parsed = parseContactRequest(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Dados inválidos." } }, { status: 400 });
  }

  if (parsed.data.website?.trim()) {
    return NextResponse.json({ data: { accepted: true } }, { status: 200 });
  }

  try {
    const { limited } = await limitContactRequest(request);
    if (limited) {
      return NextResponse.json(
        { error: { message: "Tente novamente mais tarde." } },
        { status: 429 },
      );
    }

    await sendContactEmails(parsed.data);
  } catch {
    return NextResponse.json(
      { error: { message: "Não foi possível enviar a sua solicitação. Tente novamente." } },
      { status: 503 },
    );
  }

  return NextResponse.json({ data: { accepted: true } }, { status: 202 });
}
