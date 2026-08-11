import { Bot, Code2, MessageCircle, Server } from "lucide-react";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, organizationSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Lumenva é a identidade pública de um AI Sales OS open source e self-hosted para vendas e suporte pelo WhatsApp.";
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
        title="Tecnologia aberta para operações de vendas."
        description={description}
        capabilities={[
          { icon: Code2, label: "Código distribuído sob licença MIT" },
          { icon: Server, label: "Implantação na infraestrutura da operação" },
          { icon: MessageCircle, label: "WhatsApp como canal primário" },
          { icon: Bot, label: "Agentes governados por pessoas" },
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
              retirar da equipe o controle sobre regras, dados e infraestrutura.
            </p>
          </div>
          <ul className={styles.factList}>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>01</span>
              <span><strong>Aberta.</strong> O código pode ser inspecionado e executado pela própria operação.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>02</span>
              <span><strong>Self-hosted.</strong> A implantação acontece na infraestrutura escolhida pela operação.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>03</span>
              <span><strong>Governada.</strong> Pessoas configuram capacidades, regras e handoffs dos agentes.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>04</span>
              <span><strong>Multi-tenant.</strong> O produto isola dados de organizações desde a camada do banco.</span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
