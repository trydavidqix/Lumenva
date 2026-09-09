import { Reveal } from "@/components/motion/Reveal";
import type { IntegrationItem } from "@/content/home";
import styles from "./HomeSections.module.css";

export interface IntegrationStripProps {
  readonly items: readonly IntegrationItem[];
}

export function IntegrationStrip({ items }: Readonly<IntegrationStripProps>) {
  return (
    <section className={styles.section} aria-labelledby="integrations-title">
      <div className={`site-shell ${styles.sectionStack}`}>
        <Reveal className={styles.sectionHeader}>
          <p className={styles.eyebrow}>Integrações</p>
          <h2 className={styles.sectionTitle} id="integrations-title">
            Canais e integrações documentados.
          </h2>
          <p className={styles.sectionDescription}>
            A Lumenva publica apenas conexões confirmadas pelo produto.
          </p>
        </Reveal>
        <Reveal>
          <ul className={styles.integrations}>
            {items.map((item) => (
              <li className={styles.integrationItem} key={item.name}>
                <div>
                  <p className={styles.kind}>{item.kind}</p>
                  <h3 className={styles.itemTitle}>{item.name}</h3>
                </div>
                <p className={styles.itemDescription}>{item.description}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
