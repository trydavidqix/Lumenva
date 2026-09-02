import { Robot, Database } from "@phosphor-icons/react";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { HeroProductMockup } from "@/components/sections/HeroProductMockup";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { FeatureCardGrid } from "@/components/ui/FeatureCardGrid";
import { N8nIcon, WhatsAppIcon } from "@/components/ui/BrandIcons";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Atendimento, vendas e automação com IA num só produto: WhatsApp como canal primário, CRM como contexto e agentes governados por pessoas.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Produto", path: "/produto" },
] as const;
const service = { name: "Produto Lumenva", description } as const;

const benefits = [
  { icon: WhatsAppIcon, title: "Inbox unificado", description: "Todas as conversas num só lugar: WhatsApp, Instagram, e-mail e mais." },
  { icon: Database, title: "Pipeline inteligente", description: "Acompanhe oportunidades e feche mais negócios com previsibilidade." },
  { icon: Robot, title: "Agentes de IA", description: "Agentes treinados para atender, nutrir e converter a qualquer hora." },
  { icon: N8nIcon, title: "Automação sem limites", description: "Crie fluxos com condições e integrações." },
] as const;

export const metadata = createPageMetadata({
  title: "Produto",
  description,
  path: "/produto",
});

export default function ProdutoPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={serviceSchema(service)} />
      <Breadcrumbs items={breadcrumbs} />
      <ServiceHero
        eyebrow="Produto"
        title="IA, automação e CRM na mesma operação."
        description={description}
        capabilities={[
          { icon: Robot, label: "Agentes de IA para atendimento e vendas" },
          { icon: N8nIcon, label: "Automações orientadas por eventos" },
          { icon: Database, label: "CRM com contexto de conversas e pipeline" },
          { icon: WhatsAppIcon, label: "WhatsApp como canal principal" },
        ]}
        visual={<HeroProductMockup />}
      />
      <section className={`${styles.cardsSection} ${styles.cardsSectionTopSpace}`} aria-labelledby="product-benefits">
        <div className="site-shell">
          <FeatureCardGrid ariaLabel="Benefícios do produto" items={benefits} />
        </div>
      </section>
      <section className={styles.sectionAlt} aria-labelledby="product-foundation">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="product-foundation">
              Um sistema conectado, não ferramentas isoladas.
            </h2>
            <p className={styles.sectionCopy}>
              Mensagens, leads, atividades e etapas do pipeline formam o contexto usado
              por agentes e pessoas. Regras da operação definem quando automatizar e
              quando transferir o atendimento.
            </p>
          </div>
          <ul className={styles.factList}>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>01</span>
              <span><strong>WhatsApp.</strong> O WhatsApp é o canal primário para vendas e suporte.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>02</span>
              <span><strong>Controlo humano.</strong> A equipa configura regras e pode assumir conversas.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>03</span>
              <span><strong>Contexto único.</strong> Conversas, leads e pipeline ficam no mesmo lugar.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>04</span>
              <span><strong>Multi-tenant.</strong> Dados isolados por organização em cada camada.</span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
