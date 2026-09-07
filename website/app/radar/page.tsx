import type { Metadata } from "next";
import { ArticleList } from "@/components/radar/ArticleList";
import { CategoryNav } from "@/components/radar/CategoryNav";
import { FeaturedArticle } from "@/components/radar/FeaturedArticle";
import { NewsletterCTA } from "@/components/radar/NewsletterCTA";
import { QuickRadar } from "@/components/radar/QuickRadar";
import { RadarSearch } from "@/components/radar/RadarSearch";
import { RadarHero } from "@/components/radar/RadarHero";
import { TrendingTopics } from "@/components/radar/TrendingTopics";
import { radarQuickItems } from "@/content/radar/quick";
import { getAllRadarArticles, getFeaturedRadarArticle, getRadarCategories, getRadarTags } from "@/lib/radar/articles";
import { createPageMetadata } from "@/lib/metadata";
import styles from "@/components/radar/radar.module.css";

export const metadata: Metadata = createPageMetadata({ title: "Lumenva Radar", description: "IA, agentes, automação e tecnologia aplicada — notícias, análises e guias da Lumenva.", path: "/radar" });

export default function RadarPage() {
  const articles = getAllRadarArticles();
  const featured = getFeaturedRadarArticle();
  return <div className={styles.shell}>
    <RadarHero featured={featured} />
    {featured ? <FeaturedArticle article={featured} /> : null}
    <CategoryNav categories={getRadarCategories()} />
    <section className={styles.section}><p className={styles.eyebrow}>ÚLTIMAS PUBLICAÇÕES</p><h2>Radar</h2><ArticleList articles={articles} /></section>
    <QuickRadar items={radarQuickItems} />
    <RadarSearch articles={articles} />
    <TrendingTopics tags={getRadarTags()} />
    <NewsletterCTA />
  </div>;
}
