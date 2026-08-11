import { HelpCircle, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Fale com a nossa equipa para um plano adequado ao tamanho e às necessidades da sua operação.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Preços", path: "/precos" },
] as const;
const service = { name: "Preços Lumenva", description } as const;

export const metadata = createPageMetadata({
  title: "Preços",
  description,
  path: "/precos",
});

export default function PrecosPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={serviceSchema(service)} />
      <Breadcrumbs items={breadcrumbs} />
      <ServiceHero
        eyebrow="Preços"
        title="Um plano ajustado à sua operação."
        description={description}
        capabilities={[
          { icon: Users, label: "Sem limite artificial de utilizadores" },
          { icon: ShieldCheck, label: "Multi-tenant seguro" },
          { icon: TrendingUp, label: "Escala com a sua operação" },
          { icon: HelpCircle, label: "Apoio dedicado à implementação" },
        ]}
      />
      <section className={styles.sectionAlt} aria-labelledby="pricing-model">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="pricing-model">
              Como funciona.
            </h2>
            <p className={styles.sectionCopy}>
              Cada operação tem necessidades diferentes de volume, canais e equipa.
              Fale com a nossa equipa para definir o plano certo e receber apoio
              dedicado durante a implementação e a configuração inicial.
            </p>
          </div>
          <ul className={styles.factList}>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>01</span>
              <span><strong>Sob medida.</strong> O plano acompanha o tamanho e o ritmo da sua operação.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>02</span>
              <span><strong>Sem letras miúdas.</strong> Condições claras, definidas com a nossa equipa.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>03</span>
              <span><strong>Dados protegidos.</strong> Isolamento multi-tenant desde a camada do banco.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>04</span>
              <span><strong>Apoio à implementação.</strong> Fale com a equipa para planear a sua operação.</span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
