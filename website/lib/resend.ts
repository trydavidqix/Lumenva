import { Resend } from "resend";
import type { ContactRequest } from "@/lib/contact-form";

function getResendConfig(): { apiKey: string; from: string } {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error("Resend is not configured.");
  }

  return { apiKey, from };
}

export async function sendContactEmails(request: ContactRequest): Promise<void> {
  const { apiKey, from } = getResendConfig();
  const resend = new Resend(apiKey);
  const teamMessage = await resend.emails.send({
    from,
    to: ["contato@lumenva.pt"],
    replyTo: request.email,
    subject: `Novo contacto: ${request.name}`,
    text: [
      `Nome: ${request.name}`,
      `Empresa: ${request.company}`,
      `E-mail: ${request.email}`,
      `WhatsApp: ${request.whatsapp}`,
      ...(request.message ? [`Mensagem: ${request.message}`] : []),
    ].join("\n"),
  });

  if (teamMessage.error) {
    throw new Error("Unable to send the team contact email.");
  }

  const acknowledgement = await resend.emails.send({
    from,
    to: [request.email],
    subject: "Lumenva: recebemos a sua solicitação",
    text: `Olá, ${request.name}. Recebemos a sua solicitação e entraremos em contacto brevemente.`,
  });

  if (acknowledgement.error) {
    throw new Error("Unable to send the contact acknowledgement.");
  }
}
