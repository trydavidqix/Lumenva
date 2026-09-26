import { Reveal } from "@/components/motion/Reveal";
import type {
  CapabilitySection,
} from "@/content/home";
import type { Service } from "@/content/services";
import styles from "./HomeSections.module.css";

export interface CapabilityOverviewProps {
  readonly items: readonly Service[];
}

export function CapabilityOverview({ items }: Readonly<CapabilityOverviewProps>) {
  return (
    <section className={styles.section} aria-labelledby="capabilities-title">
      <div className={`site-shell ${styles.sectionStack}`}>
        <Reveal className={styles.sectionHeader}>
          <p className={styles.eyebrow}>O que a Lumenva faz</p>
          <h2 className={styles.sectionTitle} id="capabilities-title">
            Agentes, automações e CRM trabalham como um sistema.
          </h2>
          <p className={styles.sectionDescription}>
            Cada parte partilha o mesmo contexto operacional, do WhatsApp ao pipeline.
          </p>
        </Reveal>
        <Reveal>
          <ul className={styles.overviewList}>
            {items.map((item) => (
              <li className={styles.overviewItem} key={item.name}>
                <p className={styles.itemTitle}>{item.name}</p>
                <p className={styles.itemDescription}>{item.description}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

export interface CapabilitySectionsProps {
  readonly sections: readonly CapabilitySection[];
}

export function CapabilitySections({
  sections,
}: Readonly<CapabilitySectionsProps>) {
  return (
    <div className={styles.capabilitySections}>
      {sections.map((section) => (
        <section
          className={styles.section}
          id={section.id}
          aria-labelledby={`${section.id}-title`}
          key={section.id}
        >
          <div className={`site-shell ${styles.capabilitySection}`}>
            <Reveal className={styles.sectionHeader}>
              <p className={styles.eyebrow}>{section.eyebrow}</p>
              <h2 className={styles.sectionTitle} id={`${section.id}-title`}>
                {section.title}
              </h2>
              <p className={styles.sectionDescription}>{section.description}</p>
            </Reveal>
            <Reveal>
              <ul className={styles.detailList}>
                {section.items.map((item) => (
                  <li className={styles.detailItem} key={item.label}>
                    <h3 className={styles.itemTitle}>{item.label}</h3>
                    <p className={styles.itemDescription}>{item.description}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>
      ))}
    </div>
  );
}
