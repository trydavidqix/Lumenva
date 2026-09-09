export type BlogArticleType = "noticia" | "insight" | "guia";

export type BlogBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "bullets"; items: readonly string[] }
  | { type: "quote"; text: string; cite?: string }
  | { type: "callout"; title?: string; text: string }
  | { type: "image"; src: string; alt: string; caption?: string };

export type BlogSource = Readonly<{ label: string; url: string }>;

export type BlogArticle = Readonly<{
  slug: string;
  title: string;
  subtitle?: string;
  excerpt: string;
  type: BlogArticleType;
  category: string;
  tags: readonly string[];
  publishedAt: string;
  updatedAt?: string;
  readingMinutes: number;
  featured: boolean;
  cover?: Readonly<{ src: string; alt: string }>;
  seo?: Readonly<{ title?: string; description?: string }>;
  sources: readonly BlogSource[];
  body: readonly BlogBlock[];
}>;
