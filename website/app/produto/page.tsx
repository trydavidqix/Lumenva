import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
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
          "Agentes de IA para atendimento e vendas",
          "Automações orientadas por eventos",
          "CRM com contexto de conversas e pipeline",
          "Execução na sua própria infraestrutura",
        ]}
      />
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
              <span><strong>WhatsApp-native.</strong> O WhatsApp é o canal primário para vendas e suporte.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>02</span>
              <span><strong>Controle humano.</strong> A equipe configura regras e pode assumir conversas.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>03</span>
              <span><strong>Open source.</strong> O código é distribuído sob licença MIT.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>04</span>
              <span><strong>Self-hosted.</strong> A plataforma roda na infraestrutura da operação.</span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
