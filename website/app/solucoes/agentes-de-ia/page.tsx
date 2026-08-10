import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Agentes de IA usam o contexto da sua operação para atender, qualificar e executar ações no WhatsApp, com regras, permissões e handoff para pessoas.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Soluções", path: "/solucoes" },
  { name: "Agentes de IA", path: "/solucoes/agentes-de-ia" },
] as const;
const service = { name: "Agentes de IA Lumenva", description } as const;

export const metadata = createPageMetadata({
  title: "Agentes de IA",
  description,
  path: "/solucoes/agentes-de-ia",
});

export default function AgentesDeIaPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={serviceSchema(service)} />
      <Breadcrumbs items={breadcrumbs} />
      <ServiceHero
        eyebrow="Agentes de IA"
        title="Crie agentes de IA que atendem, qualificam e executam tarefas por você."
        description={description}
        capabilities={[
          "Treine com o contexto da sua operação",
          "Especialize agentes por função",
          "Automatize com controle e permissões",
          "Acompanhe desempenho e histórico",
        ]}
      />
      <section className={styles.sectionAlt} aria-labelledby="ai-operation">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="ai-operation">
              Agentes trabalham dentro da operação, não ao lado dela.
            </h2>
            <p className={styles.sectionCopy}>
              O agente interpreta mensagens e o contexto disponível, escolhe uma ação
              entre as capacidades configuradas e registra o andamento no CRM. A equipe
              permanece responsável pelas regras, pelas permissões e pela transferência
              do atendimento.
            </p>
          </div>
          <ul className={styles.factList}>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>01</span>
              <span><strong>Base de conhecimento.</strong> A busca RAG recupera documentos autorizados da organização.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>02</span>
              <span><strong>Contexto do CRM.</strong> Conversas, atividades e dados do lead acompanham o atendimento.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>03</span>
              <span><strong>Ações com permissão.</strong> Capacidades e guardrails definem o que cada agente pode fazer.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>04</span>
              <span><strong>Supervisão e handoff.</strong> A equipe acompanha o desempenho e pode assumir a conversa quando necessário.</span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
