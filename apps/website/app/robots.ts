import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/metadata";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      { userAgent: "*", allow: "/" },

      // OpenAI: GPTBot trains models, OAI-SearchBot/ChatGPT-User serve live citations.
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "OAI-SearchBot", allow: "/" },
      { userAgent: "ChatGPT-User", allow: "/" },

      // Anthropic: current bot family (anthropic-ai / Claude-Web are deprecated tokens).
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "Claude-User", allow: "/" },
      { userAgent: "Claude-SearchBot", allow: "/" },

      // Perplexity: indexing bot and user-triggered fetcher.
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "Perplexity-User", allow: "/" },

      // Google AI training opt-in signal (independent of classic Googlebot/Search).
      { userAgent: "Google-Extended", allow: "/" },

      // Common Crawl dataset, reused by several AI trainers.
      { userAgent: "CCBot", allow: "/" },
    ],
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
