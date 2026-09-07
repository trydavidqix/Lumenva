import Link from "next/link";
import { categorySlug } from "@/lib/radar/articles";
import styles from "./radar.module.css";

export function TrendingTopics({ tags }: { tags: readonly string[] }) {
  if (!tags.length) return null;
  return <section className={styles.section} aria-labelledby="radar-topics-title">
    <p className={styles.eyebrow}>TEMAS</p><h2 id="radar-topics-title">Em foco</h2>
    <div className={styles.topics}>{tags.map((tag) => <Link href={`/radar/categoria/${categorySlug(tag)}`} key={tag}>{tag}</Link>)}</div>
  </section>;
}
