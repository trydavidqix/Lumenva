import { getSiteUrl } from "@/lib/metadata";
import type { BlogArticle } from "./types";

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");

export function serializeBlogRss(articles: readonly BlogArticle[]) {
  const base = getSiteUrl();
  const items = articles.map((article) => { const url = new URL(`/blog/${article.slug}`, base).toString(); return `<item><title>${escapeXml(article.title)}</title><link>${escapeXml(url)}</link><guid isPermaLink="true">${escapeXml(url)}</guid><pubDate>${new Date(`${article.publishedAt}T12:00:00Z`).toUTCString()}</pubDate><description>${escapeXml(article.excerpt)}</description><category>${escapeXml(article.category)}</category></item>`; }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Blog Lumenva</title><link>${escapeXml(new URL("/blog", base).toString())}</link><description>${escapeXml("IA, agentes, automação e tecnologia aplicada.")}</description><language>pt-PT</language>${items}</channel></rss>`;
}
