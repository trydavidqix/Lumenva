import { getAllRadarArticles } from "./articles";
import type { RadarArticle } from "./types";
export function getRelatedRadarArticles(article:RadarArticle,limit=3){ return getAllRadarArticles().filter(a=>a.slug!==article.slug).map(a=>({a,score:(a.category===article.category?100:0)+a.tags.filter(t=>article.tags.includes(t)).length*10+(a.type===article.type?1:0)})).sort((x,y)=>y.score-x.score||y.a.publishedAt.localeCompare(x.a.publishedAt)).slice(0,limit).map(x=>x.a); }
