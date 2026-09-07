import Link from "next/link";
import styles from "./blog.module.css";
export interface BlogCategory { readonly label: string; readonly href: string; readonly slug: string; }
export function BlogCategoryNav({ categories, current }: Readonly<{ categories: readonly BlogCategory[]; current?: string }>) {
  return <nav className={styles.nav} aria-label="Categorias do blog">{categories.map((category) => <Link className={styles.navLink} href={category.href} aria-current={current === category.slug ? "page" : undefined} key={category.slug}>{category.label}</Link>)}</nav>;
}
