import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Conecte eventos do WhatsApp e do CRM a regras e ações para organizar leads, atribuir atendimento, enviar mensagens e criar tarefas de follow-up.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Soluções", path: "/solucoes" },
  { name: "Automação de Processos", path: "/solucoes/automacao-de-processos" },
] as const;
const service = { name: "Automação de Processos Lumenva", description } as const;

export const metadata = createPageMetadata({
  title: "Automação de Processos",
  description,
  path: "/solucoes/automacao-de-processos",
});

export default function AutomacaoDeProcessosPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={serviceSchema(service)} />
      <Breadcrumbs items={breadcrumbs} />
      <ServiceHero
        eyebrow="Automação de Processos"
        title="Automatize processos e escale a operação com mais controle."
        description={description}
        capabilities={[
          "Reduza tarefas manuais",
          "Ligue WhatsApp, CRM e tarefas da operação",
          "Mantenha controle e segurança com regras claras",
          "Escale com consistência e histórico visível",
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
              o histórico de execuções no CRM.
            </p>
          </div>
          <ul className={styles.factList}>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>01</span>
              <span><strong>Entrada.</strong> Atividades, mensagens e mudanças do CRM alimentam as regras.</span>
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
              <span><strong>Supervisão.</strong> A equipe configura regras, acompanha execuções e pode intervir.</span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
