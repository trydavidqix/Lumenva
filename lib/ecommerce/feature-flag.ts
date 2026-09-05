import { env } from "@/lib/env";
import { verifyHmac } from "@/lib/nuvemshop/oauth";
import { NuvemshopAdapter } from "./nuvemshop-adapter";
import type { EcommerceProvider } from "./types";

/** Default OFF: legacy Nuvemshop handlers retain their exact behavior. */
export function isEcommerceProviderV1Enabled(): boolean {
  return env.ECOMMERCE_PROVIDER_V1;
}

export function createNuvemshopProvider(options: ConstructorParameters<typeof NuvemshopAdapter>[0]): EcommerceProvider {
  return new NuvemshopAdapter(options);
}

export function verifyNuvemshopWebhook(
  rawBody: string,
  signature: string | null | undefined,
  clientSecret: string,
): boolean {
  if (!isEcommerceProviderV1Enabled()) {
    return verifyHmac(rawBody, signature, clientSecret);
  }
  return new NuvemshopAdapter({ storeId: "adapter", accessToken: "adapter", clientSecret }).verifyWebhookSignature(rawBody, signature);
}
