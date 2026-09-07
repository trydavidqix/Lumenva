import Link from "next/link";
import { categorySlug } from "@/lib/radar/articles";
import styles from "./radar.module.css";

export function CategoryNav({ categories }: { categories: readonly string[] }) {
  return <nav aria-label="Categorias do Radar" className={styles.categories}>
    <Link href="/radar">Todos</Link><Link href="/radar/noticias">Notícias</Link><Link href="/radar/insights">Insights</Link><Link href="/radar/guias">Guias</Link>
    {categories.map((category) => <Link key={category} href={`/radar/categoria/${categorySlug(category)}`}>{category}</Link>)}
  </nav>;
}
