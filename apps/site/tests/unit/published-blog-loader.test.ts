import { expect, test, vi } from "vitest";
import { blogArticles } from "@/content/blog/articles";
import { loadPublishedBlogArticles } from "@/lib/blog/published";

const publishedItem = {
  id: "item-1",
  title: "Artigo publicado",
  status: "published",
  content_type: "blog_article",
  created_at: "2026-09-07T08:00:00Z",
  updated_at: "2026-09-07T08:00:00Z",
  body: {
    slug: "artigo-publicado",
    excerpt: "Uma descrição de artigo publicado suficientemente longa para o carregamento público.",
    type: "insight",
    category: "Agentes",
    tags: ["IA"],
    readingMinutes: 4,
    featured: false,
    sources: [{ label: "Fonte", url: "https://example.com" }],
    body: [{ type: "paragraph", text: "Conteúdo publicado." }],
  },
} as const;

test("uses published content items when the server reader succeeds", async () => {
  const articles = await loadPublishedBlogArticles({ readPublishedItems: async () => [publishedItem] });
  expect(articles.map((article) => article.slug)).toEqual(["artigo-publicado"]);
});

test("falls back to static articles when database/configuration is unavailable", async () => {
  const fallback = [blogArticles[0]!];
  const readPublishedItems = vi.fn(async () => {
    throw new Error("Supabase is not configured");
  });
  const articles = await loadPublishedBlogArticles({ readPublishedItems, fallback });
  expect(readPublishedItems).toHaveBeenCalledOnce();
  expect(articles).toEqual(fallback);
});

test("falls back to static articles when no server reader is configured", async () => {
  const fallback = [blogArticles[1]!];
  await expect(loadPublishedBlogArticles({ fallback })).resolves.toEqual(fallback);
});
