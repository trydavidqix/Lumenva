import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Reúna conversas, leads, atividades e pipeline para agentes de IA e pessoas operarem com o mesmo contexto.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "CRM", path: "/crm" },
] as const;
const service = { name: "CRM Lumenva", description } as const;

export const metadata = createPageMetadata({
  title: "CRM",
  description,
  path: "/crm",
});

export default function CrmPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={serviceSchema(service)} />
      <Breadcrumbs items={breadcrumbs} />
      <ServiceHero
        eyebrow="CRM"
        title="O contexto de cada conversa e oportunidade."
        description={description}
        capabilities={[
          "Caixa de entrada compartilhada",
          "Pipeline com etapas configuráveis",
          "Histórico de atividades do lead",
          "Isolamento de dados por organização",
        ]}
      />
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
              <span><strong>Inbox.</strong> Conversas ficam disponíveis para o atendimento da equipe.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>02</span>
              <span><strong>Pipeline.</strong> Etapas representam o andamento de cada oportunidade.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>03</span>
              <span><strong>Customer 360.</strong> Contato, conversas e atividades formam o histórico do lead.</span>
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
