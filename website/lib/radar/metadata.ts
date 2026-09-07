import { createPageMetadata, getSiteUrl } from "@/lib/metadata";
import type { RadarArticle } from "./types";
export function createRadarArticleMetadata(article:RadarArticle){ return createPageMetadata({title:`${article.title} | Lumenva Radar`,description:article.excerpt,path:`/radar/${article.slug}`}); }
export function createRadarArticleJsonLd(article:RadarArticle){ return {"@context":"https://schema.org","@type":"Article",headline:article.title,description:article.excerpt,datePublished:article.publishedAt,dateModified:article.updatedAt??article.publishedAt,mainEntityOfPage:new URL(`/radar/${article.slug}`,getSiteUrl()).toString(),publisher:{"@type":"Organization",name:"Lumenva",url:getSiteUrl().toString()}}; }
