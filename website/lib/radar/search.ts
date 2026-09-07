import { getAllRadarArticles } from "./articles";
import type { RadarArticle } from "./types";
const norm=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt");
export function searchRadarArticles(query:string,articles:RadarArticle[]=getAllRadarArticles()) { const q=norm(query.trim()); if(!q) return [...articles].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.slug.localeCompare(b.slug)); return articles.filter(a=>norm([a.title,a.excerpt,a.category,a.type,...a.tags].join(" ")).includes(q)); }
