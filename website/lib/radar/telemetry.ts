"use client";

import { track } from "@vercel/analytics";

export const radarEvents = {
  articleView: "radar_article_view",
  relatedClick: "radar_related_click",
  shareClick: "radar_share_click",
  newsletterSubmit: "radar_newsletter_submit",
  sourceClick: "radar_source_click",
} as const;

type RadarEventProperties = {
  radar_article_view: { slug: string };
  radar_related_click: { slug: string; position?: number };
  radar_share_click: { slug: string; channel: "copy" | "linkedin" | "whatsapp" | "x" };
  radar_newsletter_submit: { source: "radar"; result: "success" | "error" };
  radar_source_click: { slug: string; source: string };
};

/** Send editorial events through the analytics provider already installed.
 * Payloads intentionally contain no email, phone, or other personal data.
 */
export function trackRadarEvent<T extends keyof RadarEventProperties>(
  event: T,
  properties: RadarEventProperties[T],
): void {
  void track(event, properties);
}
