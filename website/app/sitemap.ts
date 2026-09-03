import type { MetadataRoute } from "next";
import { legalNavigation, publicRoutes } from "@/content/site";
import { getSiteUrl } from "@/lib/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  const legalPaths = legalNavigation
    .filter((link) => !link.external)
    .map((link) => link.href);

  const paths = Array.from(
    new Set(["/", "/servicos", ...publicRoutes.map((route) => route.href), ...legalPaths]),
  );

  return paths.map((path) => ({
    url: new URL(path, siteUrl).toString(),
  }));
}
