import { NextResponse } from "next/server";
import { getAllRadarArticles } from "@/lib/radar/articles";
import { getSiteUrl } from "@/lib/metadata";

export const runtime = "nodejs";
export const dynamic = "force-static";

/**
 * Public, read-only feed seam for future consumers. It has no Social write,
 * authentication secret, or subscriber data.
 */
export function GET(): Response {
  const siteUrl = getSiteUrl();
  const data = getAllRadarArticles().map((article) => ({
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    url: new URL(`/radar/${article.slug}`, siteUrl).toString(),
    cover: article.cover ?? null,
    type: article.type,
    tags: article.tags,
    publishedAt: article.publishedAt,
  }));

  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    },
  );
}
