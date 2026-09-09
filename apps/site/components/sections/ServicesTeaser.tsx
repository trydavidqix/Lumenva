import Link from "next/link";
import { agencyServiceGroups } from "@/content/agency-services";
import styles from "./ServicesTeaser.module.css";

export function ServicesTeaser() {
  return (
    <section className={styles.section} aria-labelledby="services-teaser-title">
      <div className={`site-shell ${styles.inner}`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Além da plataforma</p>
          <h2 className={styles.title} id="services-teaser-title">Serviços para dar forma à sua presença digital.</h2>
        </div>
        <ul className={styles.groups}>{agencyServiceGroups.map((group) => <li key={group}>{group}</li>)}</ul>
        <Link className={styles.link} href="/servicos">Conhecer serviços</Link>
      </div>
    </section>
  );
}
