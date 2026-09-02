import { Funnel, ClockCounterClockwise, TrendUp, Lightning } from "@phosphor-icons/react";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { VendasCrmMockup } from "@/components/sections/VendasCrmMockup";
import { JsonLd } from "@/components/ui/JsonLd";
import { FeatureCardGrid } from "@/components/ui/FeatureCardGrid";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Centralize leads, acompanhe oportunidades, automatize follow-ups e dê à sua equipa comercial uma visão clara de cada etapa da venda.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Soluções", path: "/solucoes" },
  { name: "Vendas & CRM", path: "/solucoes/vendas-crm" },
] as const;
const service = { name: "Vendas & CRM Lumenva", description } as const;

const benefits = [
  { icon: Funnel, title: "Visualize o funil", description: "Acompanhe cada oportunidade em tempo real." },
  { icon: Lightning, title: "Ganhe produtividade", description: "Automatize tarefas e follow-ups repetitivos." },
  { icon: ClockCounterClockwise, title: "Centralize contexto", description: "Tenha histórico, notas e atividades num só lugar." },
  { icon: TrendUp, title: "Melhore conversões", description: "Tome decisões com dados claros e previsíveis." },
] as const;

export const metadata = createPageMetadata({
  title: "Vendas & CRM",
  description,
  path: "/solucoes/vendas-crm",
});

export default function VendasCrmPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={serviceSchema(service)} />
      <Breadcrumbs items={breadcrumbs} />
      <ServiceHero
        eyebrow="Solução · Vendas & CRM"
        title="Organize o funil e feche mais negócios com previsibilidade."
        description={description}
        capabilities={[
          { icon: Funnel, label: "Pipeline visual" },
          { icon: Lightning, label: "Follow-up automático" },
          { icon: ClockCounterClockwise, label: "Histórico do cliente" },
          { icon: TrendUp, label: "Relatórios de vendas" },
        ]}
        visual={<VendasCrmMockup />}
      />
      <section className={styles.cardsSection} aria-labelledby="crm-benefits">
        <div className="site-shell">
          <FeatureCardGrid ariaLabel="Benefícios de Vendas & CRM" items={benefits} />
        </div>
      </section>
      <section className={styles.sectionAlt} aria-labelledby="crm-foundation">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="crm-foundation">
              Um núcleo adaptável a diferentes operações.
            </h2>
            <p className={styles.sectionCopy}>
              Pipelines organizam o andamento das oportunidades. Vocabulários
              configuráveis permitem nomear leads, negócios e resultados de acordo com
              o tipo de operação, sem separar o histórico das conversas.
            </p>
          </div>
          <ul className={styles.factList}>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>01</span>
              <span><strong>Inbox.</strong> Conversas ficam disponíveis para o atendimento da equipa.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>02</span>
              <span><strong>Pipeline.</strong> Etapas representam o andamento de cada oportunidade e as próximas ações.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>03</span>
              <span><strong>Customer 360.</strong> Contacto, conversas e atividades formam o histórico do lead.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>04</span>
              <span><strong>Multi-tenant.</strong> RLS isola os dados de cada organização.</span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
