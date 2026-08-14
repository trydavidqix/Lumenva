import Link from "next/link";
import {
  description,
  footerNavigation,
  legalNavigation,
  shellContent,
  siteName,
  socialLinks,
} from "@/content/site";
import { LumenvaMark } from "@/components/ui/LumenvaMark";
import { socialIconMap } from "@/components/ui/BrandIcons";
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
            <LumenvaMark size={50} />
            {siteName}
          </Link>
          <p className={styles.description}>{description}</p>
          <ul className={styles.socials} aria-label="Redes sociais">
            {socialLinks.map((social) => {
              const Icon = socialIconMap[social.icon];
              return (
                <li key={social.href}>
                  <Link
                    className={styles.socialLink}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon aria-hidden="true" size={18} />
                    <span>{social.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <nav aria-label={shellContent.primaryNavigationLabel} className={styles.links}>
          {footerNavigation.map((item) => (
            <Link className={styles.link} href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className={`site-shell ${styles.legalBar}`}>
        <p className={styles.copyright}>
          © {new Date().getFullYear()} {siteName}
        </p>
        <nav aria-label="Legal" className={styles.legalLinks}>
          {legalNavigation.map((item) => (
            <Link
              className={styles.legalLink}
              href={item.href}
              key={item.href}
              rel={item.external ? "noopener noreferrer" : undefined}
              target={item.external ? "_blank" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
