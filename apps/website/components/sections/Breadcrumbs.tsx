import Link from "next/link";
import type { BreadcrumbItem } from "@/lib/schema";
import styles from "./InnerPages.module.css";

export interface BreadcrumbsProps {
  readonly items: readonly BreadcrumbItem[];
}
export function Breadcrumbs({ items }: Readonly<BreadcrumbsProps>) {
  return (
    <nav className={styles.breadcrumbs} aria-label="Navegação estrutural">
      <div className="site-shell">
        <ol className={styles.breadcrumbList}>
          {items.map((item, index) => {
            const isCurrent = index === items.length - 1;

            return (
              <li className={styles.breadcrumbItem} key={item.path}>
                {isCurrent ? (
                  <span aria-current="page">{item.name}</span>
                ) : (
                  <Link href={item.path}>{item.name}</Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
