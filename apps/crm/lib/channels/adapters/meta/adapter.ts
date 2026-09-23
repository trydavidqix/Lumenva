import { SocialChannelPort, MetaCommand, MetaResult, ExternalOperationContext } from "./port";
import { MetaDependencies } from "./dependencies";
import { verifyMetaSignature } from "../../meta/webhook";
import { sendTemplate } from "../../meta/send-template";
import { hashContract } from "../../meta/contract-hash";
// @ts-ignore
import { publishCarousel, publishPhoto } from "../../../../../../packages/integrations/meta/src/publish-ig";

export class MetaAdapter implements SocialChannelPort {
  constructor(private deps: MetaDependencies) {}

  async execute(ctx: ExternalOperationContext, command: MetaCommand): Promise<MetaResult> {
    switch (command.type) {
      case "verify_webhook":
        return this.handleVerifyWebhook(ctx, command);
      case "send_template":
        return this.handleSendTemplate(ctx, command);
      case "publish_instagram_photo":
      case "publish_instagram_carousel":
        return this.handlePublish(ctx, command);
      default:
        throw new Error(`Unknown command type: ${(command as any).type}`);
    }
  }

  private async handleVerifyWebhook(
    ctx: ExternalOperationContext,
    command: Extract<MetaCommand, { type: "verify_webhook" }>
  ): Promise<MetaResult> {
    const secret = await this.deps.getConfig("META_APP_SECRET");
    if (!secret) {
      this.deps.logger.warn("META_APP_SECRET is not configured", { organizationId: ctx.organizationId });
      return { isValid: false };
    }

    const isValid = verifyMetaSignature(command.rawBody, command.signatureHeader, secret);
    return { isValid };
  }

  private async handleSendTemplate(
    ctx: ExternalOperationContext,
    command: Extract<MetaCommand, { type: "send_template" }>
  ): Promise<MetaResult> {
    try {
      const token = await this.deps.getConfig("META_TOKEN") ?? "unknown_token";
      const graphVersion = await this.deps.getConfig("META_GRAPH_VERSION") ?? "v20.0";

      const contractHash = hashContract(command.components);

      const result = await sendTemplate({
        phoneNumberId: command.phoneNumberId,
        token,
        graphVersion,
        to: command.to,
        binding: {
          name: command.templateName,
          language: command.language,
          values: command.bindingValues,
          contractHash
        },
        current: {
          name: command.templateName,
          language: command.language,
          status: "APPROVED",
          contractHash,
          components: command.components,
        }
      });

      if (result.sent) {
        return {
          sent: true,
          tenantAwareExternalId: `${ctx.organizationId}:${result.externalId}`,
        };
      }

      // If we got here, it's a domain/validation failure, handled safely by sendTemplate
      const code = "code" in result ? result.code : null;
      const message = "message" in result ? result.message : undefined;
      const reason = "reason" in result ? result.reason : "unknown";

      this.deps.logger.error("Meta API error: Template sending failed", {
        organizationId: ctx.organizationId,
        reason,
        code,
      });

      return {
        sent: false,
        reason,
        code,
        message,
        missing: "missing" in result ? result.missing : undefined,
      };

    } catch (error) {
      // Hard crash fallback, should rarely happen if sendTemplate catches HTTP errors
      this.deps.logger.error("Meta API error: Unhandled exception during template send", {
        organizationId: ctx.organizationId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return {
        sent: false,
        reason: "api_error",
        code: null,
        message: "Internal adapter error",
      };
    }
  }

  private async handlePublish(
    ctx: ExternalOperationContext,
    command: Extract<MetaCommand, { type: "publish_instagram_photo" | "publish_instagram_carousel" }>
  ): Promise<MetaResult> {
    if (ctx.idempotencyKey) {
      const alreadyProcessed = await this.deps.idempotencyStore.has(ctx.idempotencyKey);
      if (alreadyProcessed) {
        return { id: `${ctx.organizationId}:skipped_idempotent` };
      }
    }

    const token = await this.deps.getConfig("META_TOKEN");
    if (!token) throw new Error("Missing META_TOKEN");

    try {
      let resultId: string;

      if (command.type === "publish_instagram_photo") {
        const result = await publishPhoto({
          igUserId: command.igUserId,
          accessToken: token,
          imageUrl: command.imageUrl,
          caption: command.caption,
        });
        resultId = result.id;
      } else {
        const result = await publishCarousel({
          igUserId: command.igUserId,
          accessToken: token,
          imageUrls: command.imageUrls,
          caption: command.caption,
        });
        resultId = result.id;
      }

      if (ctx.idempotencyKey) {
        await this.deps.idempotencyStore.set(ctx.idempotencyKey, 86400);
      }

      return { id: `${ctx.organizationId}:${resultId}` };

    } catch (error) {
      this.deps.logger.error("Meta API error during publish", {
        organizationId: ctx.organizationId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      // By F7 rules: observability doesn't block, but for explicitly requested publish,
      // we throw if it truly fails, so the upstream worker can backoff/retry.
      throw new Error(`Meta API error: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  }
}
