import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { JsonLd } from "@/components/ui/JsonLd";
import { Button } from "@/components/ui/Button";
import { agencyServiceGroups, agencyServices } from "@/content/agency-services";
import { createPageMetadata } from "@/lib/metadata";
import { agencyServicesSchema, breadcrumbSchema } from "@/lib/schema";
import styles from "./Servicos.module.css";

const description = "Serviços de construção, conteúdo e aquisição para complementar a operação digital da sua marca.";
const breadcrumbs = [{ name: "Início", path: "/" }, { name: "Serviços", path: "/servicos" }] as const;

export const metadata = createPageMetadata({ title: "Serviços", description, path: "/servicos" });

export default function ServicesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={agencyServicesSchema(agencyServices)} />
      <Breadcrumbs items={breadcrumbs} />
      <section className={styles.hero} aria-labelledby="services-title">
        <div className={`site-shell ${styles.heroInner}`}>
          <p className={styles.eyebrow}>Serviços</p>
          <h1 className={styles.title} id="services-title">Presença digital construída para a sua operação.</h1>
          <p className={styles.description}>{description}</p>
        </div>
      </section>
      <section className={styles.listSection} aria-labelledby="services-list-title">
        <div className={`site-shell ${styles.stack}`}>
          <h2 className={styles.visuallyHidden} id="services-list-title">Serviços de agência</h2>
          {agencyServiceGroups.map((group, groupIndex) => (
            <section className={styles.group} key={group} aria-labelledby={`group-${group}`}>
              <div className={styles.groupHeader}>
                <span aria-hidden="true" className={styles.groupIndex}>
                  {String(groupIndex + 1).padStart(2, "0")}
                </span>
                <h2 className={styles.groupTitle} id={`group-${group}`}>{group}</h2>
              </div>
              <ul className={styles.serviceList}>
                {agencyServices.filter((service) => service.group === group).map((service) => (
                  <li className={styles.serviceItem} key={service.slug}>
                    <h3 className={styles.serviceName}>{service.name}</h3>
                    <p className={styles.serviceDescription}>{service.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className={styles.ctaBlock}>
            <p className={styles.ctaCopy}>Diga-nos o que pretende construir, comunicar ou alcançar.</p>
            <Button className={styles.cta} href="/contato?intent=quote" variant="secondary">
              Pedir orçamento
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
