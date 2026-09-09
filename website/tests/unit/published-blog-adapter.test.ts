import { describe, expect, test } from "vitest";
import {
  PublishedBlogAdapterError,
  publishedContentItemToBlogArticle,
  publishedContentItemsToBlogArticles,
} from "@/lib/content-os/editorial/published-blog-adapter";

const item = (overrides: Record<string, unknown> = {}) => ({
  id: "item-1",
  title: "Agentes de IA com governança humana",
  status: "published",
  content_type: "blog_article",
  created_at: "2026-09-07T08:00:00Z",
  updated_at: "2026-09-07T09:00:00Z",
  body: {
    slug: "agentes-de-ia",
    excerpt: "Uma análise prática sobre autonomia, contexto e supervisão humana em operações empresariais.",
    type: "insight",
    category: "Agentes",
    tags: ["IA", "Agentes"],
    readingMinutes: 5,
    featured: true,
    sources: [{ label: "Documentação", url: "https://example.com/docs" }],
    body: [{ type: "heading", level: 2, text: "Análise" }, { type: "paragraph", text: "Conteúdo." }],
    seo: { title: "Agentes de IA com governança humana | Lumenva", description: "Descrição para motores de busca com contexto suficiente para o artigo." },
  },
  ...overrides,
});

describe("published blog adapter", () => {
  test("converts a published content item to BlogArticle", () => {
    const article = publishedContentItemToBlogArticle(item());
    expect(article).toMatchObject({ slug: "agentes-de-ia", title: "Agentes de IA com governança humana", type: "insight", publishedAt: "2026-09-07T08:00:00Z", updatedAt: "2026-09-07T09:00:00Z" });
    expect(article?.body).toHaveLength(2);
  });

  test("does not expose unpublished or non-blog content", () => {
    expect(publishedContentItemToBlogArticle(item({ status: "draft" }))).toBeNull();
    expect(publishedContentItemToBlogArticle(item({ content_type: "social_post" }))).toBeNull();
  });

  test("rejects invalid slug, metadata and source URL", () => {
    expect(() => publishedContentItemToBlogArticle(item({ body: { ...(item().body as object), slug: "../admin" } }))).toThrow(PublishedBlogAdapterError);
    expect(() => publishedContentItemToBlogArticle(item({ body: { ...(item().body as object), seo: { title: 12 } } }))).toThrow("invalid SEO metadata");
    expect(() => publishedContentItemToBlogArticle(item({ body: { ...(item().body as object), sources: [{ label: "Fonte", url: "javascript:alert(1)" }] } }))).toThrow("invalid source URL");
  });

  test("rejects malformed blocks and missing source evidence", () => {
    expect(() => publishedContentItemToBlogArticle(item({ body: { ...(item().body as object), body: [{ type: "image", src: "/hero.png", alt: "" }] } }))).toThrow("image.alt");
    expect(() => publishedContentItemToBlogArticle(item({ body: { ...(item().body as object), sources: [] } }))).toThrow("at least one source");
  });

  test("sorts converted articles by publication date", () => {
    const result = publishedContentItemsToBlogArticles([
      item(),
      item({ id: "item-2", created_at: "2026-09-08T08:00:00Z", body: { ...(item().body as object), slug: "novo-artigo", publishedAt: "2026-09-08T08:00:00Z" } }),
    ]);
    expect(result.map((article) => article.slug)).toEqual(["novo-artigo", "agentes-de-ia"]);
  });
});
