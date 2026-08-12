import Link from "next/link";
import type { LegalPage } from "@/content/legal";
import { siteName } from "@/content/site";
import { LumenvaMark } from "@/components/ui/LumenvaMark";
import styles from "./PrivacyPolicy.module.css";

export interface PrivacyPolicyProps {
  readonly page: LegalPage;
}

export function PrivacyPolicy({ page }: Readonly<PrivacyPolicyProps>) {
  return (
    <>
      <div className="site-shell">
        <div className={styles.utilityBar}>
          <Link aria-label={siteName} className={styles.wordmark} href="/">
            <LumenvaMark size={32} />
            {siteName}
          </Link>
          <Link className={styles.backLink} href="/">
            Voltar ao site
          </Link>
        </div>
      </div>
      <div className={`site-shell reading-measure ${styles.wrap}`}>
        <div className={styles.heroCard}>
          <p className={styles.eyebrow}>Política de Privacidade</p>
          <h1 className={styles.heroTitle}>Tratamento de dados pessoais</h1>
          <p className={styles.heroIntro}>{page.intro}</p>
          <p className={styles.lastUpdated}>
            Última atualização: {new Date(page.lastUpdated).toLocaleDateString("pt-PT")}
          </p>
        </div>
        <div className={styles.cards}>
          {page.sections.map((section, index) => (
            <div className={styles.card} key={section.heading}>
              <h2 className={styles.cardHeading}>
                <span className={styles.cardNumber}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p className={styles.cardParagraph} key={paragraph}>
                  {paragraph}
                </p>
              ))}
              {section.list ? (
                <ul className={styles.cardList}>
                  {section.list.map((item) => (
                    <li className={styles.cardListItem} key={item}>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
