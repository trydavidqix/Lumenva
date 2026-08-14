import type { LegalPage } from "@/content/legal";
import innerStyles from "./InnerPages.module.css";
import styles from "./LegalContent.module.css";

export interface LegalHeroProps {
  readonly page: LegalPage;
}

export function LegalHero({ page }: Readonly<LegalHeroProps>) {
  return (
    <section className={innerStyles.hero}>
      <div className={`site-shell ${innerStyles.heroInner} ${innerStyles.heroInnerNoVisual}`}>
        <div className={`${innerStyles.heroCopy} ${styles.heroCopy}`}>
          <p className={innerStyles.eyebrow}>Legal</p>
          <h1 className={innerStyles.title} id="legal-page-title">
            {page.title}
          </h1>
          <p className={innerStyles.description}>{page.metaDescription}</p>
        </div>
      </div>
    </section>
  );
}

export interface LegalContentProps {
  readonly page: LegalPage;
}

export function LegalContent({ page }: Readonly<LegalContentProps>) {
  return (
    <section className={styles.section} aria-labelledby="legal-page-title">
      <div className="site-shell reading-measure">
        <p className={styles.lastUpdated}>
          Última atualização: {new Date(page.lastUpdated).toLocaleDateString("pt-PT")}
        </p>
        <p className={styles.intro}>{page.intro}</p>
        <div className={styles.sections}>
          {page.sections.map((block) => (
            <div className={styles.block} key={block.heading}>
              <h2 className={styles.heading}>{block.heading}</h2>
              {block.paragraphs.map((paragraph) => (
                <p className={styles.paragraph} key={paragraph}>
                  {paragraph}
                </p>
              ))}
              {block.list ? (
                <ul className={styles.list}>
                  {block.list.map((item) => (
                    <li className={styles.listItem} key={item}>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
