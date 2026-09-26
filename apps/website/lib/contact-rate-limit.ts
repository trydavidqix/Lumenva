import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const contactRateLimit =
  redisUrl && redisToken
    ? new Ratelimit({
        redis: new Redis({ url: redisUrl, token: redisToken }),
        limiter: Ratelimit.slidingWindow(5, "1 h"),
        prefix: "lumenva:contact",
      })
    : null;

function requestIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function limitContactRequest(request: Request): Promise<{ limited: boolean }> {
  if (!contactRateLimit) {
    throw new Error("Contact rate limiting is not configured.");
  }

  const result = await contactRateLimit.limit(requestIdentifier(request));
  return { limited: !result.success };
}
