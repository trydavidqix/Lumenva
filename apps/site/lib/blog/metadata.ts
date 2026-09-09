import { createPageMetadata, getSiteUrl } from "@/lib/metadata";
import { breadcrumbSchema } from "@/lib/schema";
import type { BlogArticle } from "./types";

export function createBlogArticleMetadata(article: BlogArticle) {
  const metadata = createPageMetadata({ title: article.seo?.title ?? `${article.title} | Blog Lumenva`, description: article.seo?.description ?? article.excerpt, path: `/blog/${article.slug}` });
  metadata.openGraph = { ...metadata.openGraph, type: "article", ...(article.cover ? { images: [{ url: new URL(article.cover.src, getSiteUrl()).toString(), alt: article.cover.alt }] } : {}) };
  metadata.twitter = { ...metadata.twitter, card: article.cover ? "summary_large_image" : "summary", ...(article.cover ? { images: [new URL(article.cover.src, getSiteUrl()).toString()] } : {}) };
  return metadata;
}

export function createBlogArticleJsonLd(article: BlogArticle) {
  const siteUrl = getSiteUrl();
  const url = new URL(`/blog/${article.slug}`, siteUrl).toString();
  return { "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.seo?.description ?? article.excerpt, datePublished: article.publishedAt, dateModified: article.updatedAt ?? article.publishedAt, articleSection: article.category, keywords: article.tags.join(", "), ...(article.cover ? { image: new URL(article.cover.src, siteUrl).toString() } : {}), mainEntityOfPage: { "@type": "WebPage", "@id": url }, author: { "@type": "Organization", name: "Lumenva", url: siteUrl.toString() }, publisher: { "@type": "Organization", name: "Lumenva", url: siteUrl.toString() } };
}

export function createBlogBreadcrumbJsonLd(article: BlogArticle) {
  const category = article.category.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return breadcrumbSchema([{ name: "Início", path: "/" }, { name: "Blog", path: "/blog" }, { name: article.category, path: `/blog/categoria/${category}` }, { name: article.title, path: `/blog/${article.slug}` }]);
}
