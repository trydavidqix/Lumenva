export type RadarArticleType = "noticia" | "insight" | "guia";
export type RadarBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "quote"; text: string; cite?: string }
  | { type: "callout"; title?: string; text: string }
  | { type: "image"; src: string; alt: string; caption?: string };
export type RadarSource = { label: string; url: string };
export type RadarArticle = {
  slug: string;
  title: string;
  subtitle?: string;
  excerpt: string;
  type: RadarArticleType;
  category: string;
  tags: string[];
  publishedAt: string;
  updatedAt?: string;
  readingMinutes: number;
  featured: boolean;
  cover?: { src: string; alt: string };
  seo?: { title?: string; description?: string };
  sources: RadarSource[];
  body: RadarBlock[];
};
export type RadarQuickItem = { id: string; title: string; summary: string; publishedAt: string; href?: string; source?: RadarSource };
