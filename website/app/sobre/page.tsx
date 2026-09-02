import { Robot, ShieldCheck, UsersThree } from "@phosphor-icons/react/ssr";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";
import { JsonLd } from "@/components/ui/JsonLd";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, organizationSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Os princípios que orientam o produto Lumenva: contexto único entre conversas e pipeline, controlo da equipa sobre regras e agentes, e dados isolados por organização.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Sobre", path: "/sobre" },
] as const;

export const metadata = createPageMetadata({
  title: "Sobre a Lumenva",
  description,
  path: "/sobre",
});

export default function AboutPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={organizationSchema()} />
      <Breadcrumbs items={breadcrumbs} />
      <ServiceHero
        eyebrow="Sobre a Lumenva"
        title="Uma plataforma feita para equipas de vendas e suporte."
        description={description}
        capabilities={[
          { icon: Robot, label: "Agentes de IA governados por pessoas" },
          { icon: WhatsAppIcon, label: "WhatsApp como canal primário" },
          { icon: ShieldCheck, label: "Multi-tenant seguro" },
          { icon: UsersThree, label: "Equipa acompanha cada operação" },
        ]}
      />
      <section className={styles.sectionAlt} aria-labelledby="principles-title">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="principles-title">
              Princípios do produto.
            </h2>
            <p className={styles.sectionCopy}>
              A Lumenva foi desenhada para unir agentes de IA, automações e CRM sem
              retirar da equipa o controlo sobre regras, dados e operação.
            </p>
          </div>
          <ul className={styles.factList}>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>01</span>
              <span><strong>Contexto único.</strong> Conversas, leads e atividades ficam no mesmo lugar.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>02</span>
              <span><strong>Controlada.</strong> A equipa define regras, permissões e prioridades.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>03</span>
              <span><strong>Governada.</strong> Pessoas configuram capacidades, regras e handoffs dos agentes.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>04</span>
              <span><strong>Multi-tenant.</strong> O produto isola dados de organizações desde a camada da base de dados.</span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
