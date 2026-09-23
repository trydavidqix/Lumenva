import { Resend } from "resend";

export type ExternalOperationContext = {
  organizationId: string;
  requestId: string;
  idempotencyKey?: string;
  dryRun?: boolean;
};

export interface ExternalAdapter<Command, Result> {
  execute(ctx: ExternalOperationContext, command: Command): Promise<Result>;
}

export interface SendEmailCommand {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: "not_configured" | "send_failed" | "rate_limited";
  details?: string;
}

export class ResendAdapter implements ExternalAdapter<SendEmailCommand, SendEmailResult> {
  private client: Resend | null = null;

  private getClient(): Resend | null {
    if (this.client) return this.client;
    const key = process.env.RESEND_API_KEY;
    if (!key || key.length < 10) return null;
    this.client = new Resend(key);
    return this.client;
  }

  private fromAddress(): string {
    return process.env.RESEND_FROM_EMAIL || "Lumenva <noreply@deskcomm.app>";
  }

  async execute(ctx: ExternalOperationContext, command: SendEmailCommand): Promise<SendEmailResult> {
    const client = this.getClient();

    if (!client) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[email] RESEND_API_KEY não configurada — email não enviado. Payload:",
          {
            to: command.to,
            subject: command.subject,
            preview: command.text?.slice(0, 200) ?? command.html.slice(0, 200),
          },
        );
      }
      return { ok: false, error: "not_configured" };
    }

    try {
      const tags = command.tags ? [...command.tags] : [];
      let headers: Record<string, string> = {};

      if (ctx.idempotencyKey) {
        // Tag for observability
        tags.push({ name: "idempotency_key", value: ctx.idempotencyKey });
        // Native Resend idempotency header
        headers = { "Idempotency-Key": ctx.idempotencyKey };
      }

      const { data, error } = await client.emails.send({
        from: this.fromAddress(),
        to: command.to,
        subject: command.subject,
        html: command.html,
        text: command.text,
        replyTo: command.replyTo,
        tags: tags.length > 0 ? tags : undefined,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });

      if (error) {
        const isRateLimit = String(error.name || "").toLowerCase().includes("rate");
        return {
          ok: false,
          error: isRateLimit ? "rate_limited" : "send_failed",
          details: error.message,
        };
      }
      return { ok: true, id: data?.id };
    } catch (err) {
      return {
        ok: false,
        error: "send_failed",
        details: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
