export type ExternalOperationContext = {
  organizationId: string;
  requestId: string;
  idempotencyKey?: string;
  dryRun?: boolean;
};

export interface ExternalAdapter<Command, Result> {
  execute(ctx: ExternalOperationContext, command: Command): Promise<Result>;
}

export type VerifyWebhookCommand = {
  type: "verify_webhook";
  rawBody: string;
  signatureHeader: string | null;
  /** App secret is fetched via configuration */
};

export type VerifyWebhookResult = {
  isValid: boolean;
};

export type SendTemplateCommand = {
  type: "send_template";
  phoneNumberId: string;
  to: string; // The E.164 without '+'
  templateName: string;
  language: string;
  components: unknown;
  bindingValues: Record<string, string>;
  /** Auth token is fetched via configuration */
};

export type SendTemplateResult =
  | { sent: true; tenantAwareExternalId: string }
  | { sent: false; reason: string; missing?: string[]; code?: number | null; message?: string };

export type PublishInstagramCarouselCommand = {
  type: "publish_instagram_carousel";
  igUserId: string;
  imageUrls: string[];
  caption: string;
  /** Auth token is fetched via configuration */
};

export type PublishInstagramPhotoCommand = {
  type: "publish_instagram_photo";
  igUserId: string;
  imageUrl: string;
  caption: string;
  /** Auth token is fetched via configuration */
};

export type PublishResult = {
  id: string; // Tenant aware format: orgId:id
};

export type MetaCommand =
  | VerifyWebhookCommand
  | SendTemplateCommand
  | PublishInstagramCarouselCommand
  | PublishInstagramPhotoCommand;

export type MetaResult =
  | VerifyWebhookResult
  | SendTemplateResult
  | PublishResult;

export interface SocialChannelPort extends ExternalAdapter<MetaCommand, MetaResult> {}
