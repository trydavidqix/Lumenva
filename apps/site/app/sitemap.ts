import type { MetadataRoute } from "next";
import { legalNavigation, publicRoutes } from "@/content/site";
import { getSiteUrl } from "@/lib/metadata";
import { loadPublishedBlogArticles } from "@/lib/blog/published";
import { blogCategorySlug } from "@/lib/blog/articles";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  const legalPaths = legalNavigation
    .filter((link) => !link.external)
    .map((link) => link.href);

  const articles = await loadPublishedBlogArticles();
  const blogPaths = ["/blog", ...articles.map((article) => `/blog/${article.slug}`), ...new Set(articles.map((article) => `/blog/categoria/${blogCategorySlug(article.category)}`))];
  const paths = Array.from(new Set(["/", "/servicos", ...publicRoutes.map((route) => route.href), ...legalPaths, ...blogPaths]));

  return paths.map((path) => ({
    url: new URL(path, siteUrl).toString(),
  }));
}
