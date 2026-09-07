import type { MetadataRoute } from "next";
import { legalNavigation, publicRoutes } from "@/content/site";
import { categorySlug, getAllRadarArticles, getRadarCategories } from "@/lib/radar/articles";
import { getSiteUrl } from "@/lib/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const legalPaths = legalNavigation.filter((link) => !link.external).map((link) => link.href);
  const radarPaths = [
    "/radar/noticias", "/radar/insights", "/radar/guias",
    ...getRadarCategories().map((category) => `/radar/categoria/${categorySlug(category)}`),
    ...getAllRadarArticles().map((article) => `/radar/${article.slug}`),
  ];
  const paths = Array.from(new Set(["/", "/servicos", ...publicRoutes.map((route) => route.href), ...legalPaths, ...radarPaths]));
  return paths.map((path) => ({ url: new URL(path, siteUrl).toString() }));
}
