import { getAllBlogArticles } from "@/lib/blog/articles";
import {
  publishedContentItemsToBlogArticles,
  type PublishedContentItem,
} from "@/lib/content-os/editorial/published-blog-adapter";
import type { BlogArticle } from "@/lib/blog/types";

/** Server-only reader boundary. Keep Supabase out of the blog domain. */
export type PublishedContentItemsReader = () => Promise<readonly PublishedContentItem[]>;

export type PublishedBlogLoaderOptions = Readonly<{
  readPublishedItems?: PublishedContentItemsReader;
  fallback?: readonly BlogArticle[];
}>;

const SUPABASE_TIMEOUT_MS = 4_000;

/**
 * Server-only REST reader. It deliberately requires the service-role key to
 * remain optional: local builds without Content OS use the static fallback.
 */
export async function readPublishedContentItems(): Promise<readonly PublishedContentItem[]> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase Content OS is not configured");

  const endpoint = new URL("/rest/v1/content_items", supabaseUrl);
  endpoint.searchParams.set("status", "eq.published");
  endpoint.searchParams.set("content_type", "like.blog*");
  endpoint.searchParams.set("select", "id,title,status,content_type,body,created_at,updated_at");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Supabase Content OS returned HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error("Supabase Content OS returned an invalid payload");
    return payload as PublishedContentItem[];
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadPublishedBlogArticles(
  options: PublishedBlogLoaderOptions = {},
): Promise<readonly BlogArticle[]> {
  const fallback = options.fallback ?? getAllBlogArticles();
  const reader = options.readPublishedItems ?? readPublishedContentItems;

  try {
    const items = await reader();
    return publishedContentItemsToBlogArticles(items);
  } catch {
    // Database/configuration outages must not make the public blog unavailable.
    return fallback;
  }
}

export function createPublishedBlogLoader(
  readPublishedItems: PublishedContentItemsReader,
  fallback: readonly BlogArticle[] = getAllBlogArticles(),
): () => Promise<readonly BlogArticle[]> {
  return () => loadPublishedBlogArticles({ readPublishedItems, fallback });
}
