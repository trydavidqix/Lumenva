import type { BlogArticle, BlogArticleType, BlogBlock, BlogSource } from "@/lib/blog/types";

export type PublishedContentItem = Readonly<{
  id: string;
  title: string;
  status: string;
  content_type: string;
  body: unknown;
  created_at: string;
  updated_at: string;
}>;

export class PublishedBlogAdapterError extends Error {
  readonly name = "PublishedBlogAdapterError";
}

type ArticleBody = {
  slug: string;
  excerpt: string;
  type: BlogArticleType;
  category: string;
  tags: string[];
  publishedAt: string;
  updatedAt?: string;
  readingMinutes: number;
  featured: boolean;
  subtitle?: string;
  cover?: { src: string; alt: string };
  seo?: { title?: string; description?: string };
  sources: BlogSource[];
  body: BlogBlock[];
};

const articleTypes = new Set<BlogArticleType>(["noticia", "insight", "guia"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new PublishedBlogAdapterError(`Published blog item has invalid ${field}`);
  return value.trim();
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return requiredString(value, field);
}

function parseSlug(value: unknown): string {
  const slug = requiredString(value, "slug");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new PublishedBlogAdapterError("Published blog item has invalid slug");
  return slug;
}

function parseDate(value: unknown, field: string): string {
  const date = requiredString(value, field);
  if (Number.isNaN(Date.parse(date))) throw new PublishedBlogAdapterError(`Published blog item has invalid ${field}`);
  return date;
}

function parseBlocks(value: unknown): BlogBlock[] {
  if (!Array.isArray(value) || value.length === 0) throw new PublishedBlogAdapterError("Published blog item has invalid body blocks");
  return value.map((block) => {
    if (!isRecord(block) || typeof block.type !== "string") throw new PublishedBlogAdapterError("Published blog item has invalid body block");
    if (["paragraph", "heading", "quote", "callout"].includes(block.type)) {
      const text = requiredString(block.text, `${block.type}.text`);
      if (block.type === "heading") {
        if (block.level !== 2 && block.level !== 3) throw new PublishedBlogAdapterError("Published blog item has invalid heading level");
        return { type: "heading", level: block.level, text };
      }
      if (block.type === "quote") return { type: "quote", text, ...(optionalString(block.cite, "quote.cite") ? { cite: optionalString(block.cite, "quote.cite") } : {}) };
      if (block.type === "callout") return { type: "callout", text, ...(optionalString(block.title, "callout.title") ? { title: optionalString(block.title, "callout.title") } : {}) };
      return { type: "paragraph", text };
    }
    if (block.type === "bullets") {
      if (!Array.isArray(block.items) || block.items.length === 0 || block.items.some((item) => typeof item !== "string" || !item.trim())) throw new PublishedBlogAdapterError("Published blog item has invalid bullet items");
      return { type: "bullets", items: block.items.map((item) => (item as string).trim()) };
    }
    if (block.type === "image") {
      return { type: "image", src: requiredString(block.src, "image.src"), alt: requiredString(block.alt, "image.alt"), ...(optionalString(block.caption, "image.caption") ? { caption: optionalString(block.caption, "image.caption") } : {}) };
    }
    throw new PublishedBlogAdapterError(`Published blog item has unsupported block type: ${block.type}`);
  });
}

function parseSources(value: unknown): BlogSource[] {
  if (!Array.isArray(value) || value.length === 0) throw new PublishedBlogAdapterError("Published blog item needs at least one source");
  return value.map((source) => {
    if (!isRecord(source)) throw new PublishedBlogAdapterError("Published blog item has invalid source");
    const label = requiredString(source.label, "source.label");
    const url = requiredString(source.url, "source.url");
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
    } catch {
      throw new PublishedBlogAdapterError(`Published blog item has invalid source URL: ${label}`);
    }
    return { label, url };
  });
}

function parseBody(item: PublishedContentItem): ArticleBody {
  if (!isRecord(item.body)) throw new PublishedBlogAdapterError("Published blog item body must be an object");
  const body = item.body;
  const type = requiredString(body.type, "type") as BlogArticleType;
  if (!articleTypes.has(type)) throw new PublishedBlogAdapterError("Published blog item has invalid article type");
  const tags = body.tags;
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string" || !tag.trim())) throw new PublishedBlogAdapterError("Published blog item has invalid tags");
  const readingMinutes = body.readingMinutes;
  if (typeof readingMinutes !== "number" || !Number.isInteger(readingMinutes) || readingMinutes < 1) throw new PublishedBlogAdapterError("Published blog item has invalid readingMinutes");
  const seo = body.seo;
  if (seo !== undefined && (!isRecord(seo) || (seo.title !== undefined && typeof seo.title !== "string") || (seo.description !== undefined && typeof seo.description !== "string"))) throw new PublishedBlogAdapterError("Published blog item has invalid SEO metadata");
  return {
    slug: parseSlug(body.slug),
    excerpt: requiredString(body.excerpt, "excerpt"),
    type,
    category: requiredString(body.category, "category"),
    tags: tags.map((tag) => (tag as string).trim()),
    publishedAt: parseDate(body.publishedAt ?? item.created_at, "publishedAt"),
    updatedAt: parseDate(body.updatedAt ?? item.updated_at, "updatedAt"),
    readingMinutes,
    featured: body.featured === true,
    subtitle: optionalString(body.subtitle, "subtitle"),
    cover: body.cover === undefined ? undefined : (() => {
      if (!isRecord(body.cover)) throw new PublishedBlogAdapterError("Published blog item has invalid cover");
      return { src: requiredString(body.cover.src, "cover.src"), alt: requiredString(body.cover.alt, "cover.alt") };
    })(),
    seo: seo === undefined ? undefined : { title: optionalString(seo.title, "seo.title"), description: optionalString(seo.description, "seo.description") },
    sources: parseSources(body.sources),
    body: parseBlocks(body.body),
  };
}

export function publishedContentItemToBlogArticle(item: PublishedContentItem): BlogArticle | null {
  if (item.status !== "published") return null;
  if (!item.content_type.toLowerCase().startsWith("blog")) return null;
  const parsed = parseBody(item);
  return { slug: parsed.slug, title: requiredString(item.title, "title"), excerpt: parsed.excerpt, type: parsed.type, category: parsed.category, tags: parsed.tags, publishedAt: parsed.publishedAt, updatedAt: parsed.updatedAt, readingMinutes: parsed.readingMinutes, featured: parsed.featured, ...(parsed.subtitle ? { subtitle: parsed.subtitle } : {}), ...(parsed.cover ? { cover: parsed.cover } : {}), ...(parsed.seo ? { seo: parsed.seo } : {}), sources: parsed.sources, body: parsed.body };
}

export function publishedContentItemsToBlogArticles(items: readonly PublishedContentItem[]): readonly BlogArticle[] {
  return items.flatMap((item) => {
    const article = publishedContentItemToBlogArticle(item);
    return article ? [article] : [];
  }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));
}
