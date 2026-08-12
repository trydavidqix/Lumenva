import { NextResponse } from "next/server";
import { parseContactRequest } from "@/lib/contact-form";
import { limitContactRequest } from "@/lib/contact-rate-limit";
import { sendContactEmails } from "@/lib/resend";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
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
