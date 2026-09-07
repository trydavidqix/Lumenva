import { loadPublishedBlogArticles } from "@/lib/blog/published";
import { serializeBlogRss } from "@/lib/blog/rss";
export async function GET() { return new Response(serializeBlogRss(await loadPublishedBlogArticles()), { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=3600" } }); }
