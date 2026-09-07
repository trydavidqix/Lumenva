import Link from "next/link";
import type { RadarArticle } from "@/lib/radar/types";
import styles from "./radar.module.css";

export function RadarHero({ featured, title = "O que está a mudar em IA — e o que isso muda para empresas.", description = "Notícias selecionadas, análises e guias sobre agentes, automação e tecnologia aplicada." }: { featured?: RadarArticle; title?: string; description?: string }) {
  return <header className={styles.hero}>
    <p className={styles.eyebrow}>LUMENVA RADAR</p>
    <h1>{title}</h1>
    <p className={styles.lead}>{description}</p>
    {featured ? <Link className={styles.heroLink} href={`/radar/${featured.slug}`}>Ler destaque: {featured.title}<span aria-hidden="true"> →</span></Link> : null}
  </header>;
}
