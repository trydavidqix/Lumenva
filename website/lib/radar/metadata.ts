import { createPageMetadata, getSiteUrl } from "@/lib/metadata";
import { breadcrumbSchema } from "@/lib/schema";
import type { RadarArticle } from "./types";

export function createRadarArticleMetadata(article: RadarArticle) {
  const metadata = createPageMetadata({ title: article.seo?.title ?? `${article.title} | Lumenva Radar`, description: article.seo?.description ?? article.excerpt, path: `/radar/${article.slug}` });
  if (article.cover) {
    const imageUrl = new URL(article.cover.src, getSiteUrl()).toString();
    metadata.openGraph = { ...metadata.openGraph, type: "article", images: [{ url: imageUrl, alt: article.cover.alt }] };
    metadata.twitter = { ...metadata.twitter, card: "summary_large_image", images: [imageUrl] };
  } else metadata.openGraph = { ...metadata.openGraph, type: "article" };
  return metadata;
}

export function createRadarArticleJsonLd(article: RadarArticle) {
  const siteUrl = getSiteUrl();
  const url = new URL(`/radar/${article.slug}`, siteUrl).toString();
  return { "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.seo?.description ?? article.excerpt, datePublished: article.publishedAt, dateModified: article.updatedAt ?? article.publishedAt, articleSection: article.category, keywords: article.tags.join(", "), ...(article.cover ? { image: new URL(article.cover.src, siteUrl).toString() } : {}), mainEntityOfPage: { "@type": "WebPage", "@id": url }, author: { "@type": "Organization", name: "Lumenva", url: siteUrl.toString() }, publisher: { "@type": "Organization", name: "Lumenva", url: siteUrl.toString() } };
}

export function createRadarBreadcrumbJsonLd(article: RadarArticle) {
  const categorySlug = article.category.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return breadcrumbSchema([{ name: "Início", path: "/" }, { name: "Lumenva Radar", path: "/radar" }, { name: article.category, path: `/radar/categoria/${categorySlug}` }, { name: article.title, path: `/radar/${article.slug}` }]);
}
