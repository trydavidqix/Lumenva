import Link from "next/link";
import { description, githubUrl, navigation, shellContent, siteName } from "@/content/site";
import styles from "./Footer.module.css";

export interface FooterProps {
  readonly children?: never;
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`site-shell ${styles.content}`}>
        <div className={styles.brand}>
          <Link aria-label={siteName} className={styles.wordmark} href="/">
            {siteName}
          </Link>
          <p className={styles.description}>{description}</p>
          <a
            className={styles.link}
            href={githubUrl}
            rel="noreferrer"
            target="_blank"
          >
            {shellContent.githubLabel}
          </a>
        </div>
        <nav aria-label={shellContent.primaryNavigationLabel} className={styles.links}>
          {navigation.map((item) => (
            <Link className={styles.link} href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
