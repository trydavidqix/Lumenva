export type ExternalOperationContext = {
  organizationId: string;
  requestId: string;
  idempotencyKey?: string;
  dryRun?: boolean;
};

export interface ExternalAdapter<Command, Result> {
  execute(ctx: ExternalOperationContext, command: Command): Promise<Result>;
}

export type ChannelTransportCommand =
  | {
      type: "send_message";
      sessionRef: string;
      to: string;
      kind?: string;
      body?: string;
      media?: {
        url: string;
        mimetype: string;
        filename?: string;
        caption?: string;
      };
    }
  | { type: "stop_session"; sessionRef: string }
  | { type: "start_session"; sessionRef: string }
  | { type: "logout_session"; sessionRef: string }
  | {
      type: "verify_webhook";
      rawBody: string;
      signatureHeader: string | null;
      sessionSecret: string | null
    };

export type ChannelTransportResult = {
  externalId?: string | null;
  status?: string;
  qr?: string;
  isValid?: boolean;
  reason?: string;
  error?: {
    code: string;
    message: string;
  };
};

export interface ChannelTransportPort extends ExternalAdapter<ChannelTransportCommand, ChannelTransportResult> {}
