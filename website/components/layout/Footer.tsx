import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { FaFacebookF, FaGithub, FaInstagram } from "react-icons/fa";
import {
  description,
  footerNavigation,
  githubUrl,
  shellContent,
  siteName,
} from "@/content/site";
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
          <ul className={styles.socials} aria-label="Redes sociais">
            <li>
              <a
                className={styles.socialLink}
                href={githubUrl}
                rel="noreferrer"
                target="_blank"
              >
                <FaGithub aria-hidden="true" size={18} />
                <span>{shellContent.githubLabel}</span>
              </a>
            </li>
            <li>
              <span
                className={styles.socialPlaceholder}
                role="img"
                aria-label="WhatsApp: perfil ainda não configurado"
              >
                <MessageCircle aria-hidden="true" size={18} strokeWidth={1.8} />
                <span>WhatsApp</span>
              </span>
            </li>
            <li>
              <span
                className={styles.socialPlaceholder}
                role="img"
                aria-label="Facebook: perfil ainda não configurado"
              >
                <FaFacebookF aria-hidden="true" size={18} />
                <span>Facebook</span>
              </span>
            </li>
            <li>
              <span
                className={styles.socialPlaceholder}
                role="img"
                aria-label="Instagram: perfil ainda não configurado"
              >
                <FaInstagram aria-hidden="true" size={18} />
                <span>Instagram</span>
              </span>
            </li>
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
    </footer>
  );
}
