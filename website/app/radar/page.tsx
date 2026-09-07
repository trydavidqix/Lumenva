import type { Metadata } from "next";
import Link from "next/link";
import { ArticleList } from "@/components/radar/ArticleList";
import { CategoryNav } from "@/components/radar/CategoryNav";
import { NewsletterCTA } from "@/components/radar/NewsletterCTA";
import { QuickRadar } from "@/components/radar/QuickRadar";
import { RadarSearch } from "@/components/radar/RadarSearch";
import { radarQuickItems } from "@/content/radar/quick";
import { getAllRadarArticles, getFeaturedRadarArticle, getRadarCategories, getRadarTags } from "@/lib/radar/articles";
import { createPageMetadata } from "@/lib/metadata";
import styles from "@/components/radar/radar.module.css";

export const metadata: Metadata = createPageMetadata({ title: "Lumenva Radar", description: "IA, agentes, automação e tecnologia aplicada — notícias, análises e guias da Lumenva.", path: "/radar" });

export default function RadarPage() {
  const articles = getAllRadarArticles();
  const featured = getFeaturedRadarArticle();
  return <div className={styles.shell}>
    <header className={styles.hero}><p className={styles.eyebrow}>LUMENVA RADAR</p><h1>O que está a mudar em IA — e o que isso muda para empresas.</h1><p className={styles.lead}>Notícias selecionadas, análises e guias sobre agentes, automação e tecnologia aplicada.</p>{featured && <p><Link href={`/radar/${featured.slug}`}>Em destaque: {featured.title} →</Link></p>}</header>
    <CategoryNav categories={getRadarCategories()} />
    <section className={styles.section}><p className={styles.eyebrow}>ÚLTIMAS PUBLICAÇÕES</p><h2>Radar</h2><ArticleList articles={articles} /></section>
    <QuickRadar items={radarQuickItems} />
    <RadarSearch articles={articles} />
    <section className={styles.section}><p className={styles.eyebrow}>TEMAS</p><h2>Em foco</h2><div className={styles.categories}>{getRadarTags().map(tag => <span key={tag}>{tag}</span>)}</div></section>
    <NewsletterCTA />
  </div>;
}
