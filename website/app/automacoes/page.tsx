import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Conecte eventos do CRM a regras e ações para organizar leads, atribuir atendimento e enviar mensagens.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Automações", path: "/automacoes" },
] as const;
const service = { name: "Automações Lumenva", description } as const;

export const metadata = createPageMetadata({
  title: "Automações",
  description,
  path: "/automacoes",
});

export default function AutomationsPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={serviceSchema(service)} />
      <Breadcrumbs items={breadcrumbs} />
      <ServiceHero
        eyebrow="Automações"
        title="Do evento à próxima ação."
        description={description}
        capabilities={[
          "Regras acionadas por eventos do CRM",
          "Organização e movimentação de leads",
          "Atribuição de atendimento",
          "Envio de mensagens com regras da operação",
        ]}
      />
      <section className={styles.sectionAlt} aria-labelledby="automation-model">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="automation-model">
              Eventos, condições e ações visíveis.
            </h2>
            <p className={styles.sectionCopy}>
              Mudanças na operação geram eventos. As regras avaliam as condições
              configuradas e encaminham o trabalho para a ação correspondente, mantendo
              o histórico no CRM.
            </p>
          </div>
          <ul className={styles.factList}>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>01</span>
              <span><strong>Entrada.</strong> Atividades e mudanças do CRM alimentam as regras.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>02</span>
              <span><strong>Decisão.</strong> Condições definem se uma ação deve seguir.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>03</span>
              <span><strong>Execução.</strong> Workers processam os efeitos fora da transação do banco.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>04</span>
              <span><strong>Supervisão.</strong> A equipe configura regras e acompanha a operação.</span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
