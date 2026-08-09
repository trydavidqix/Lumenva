import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Agentes de IA usam contexto da operação para atender, qualificar e executar ações no WhatsApp, com regras e handoff para pessoas.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Inteligência artificial", path: "/inteligencia-artificial" },
] as const;
const service = { name: "Agentes de IA Lumenva", description } as const;

export const metadata = createPageMetadata({
  title: "Inteligência artificial",
  description,
  path: "/inteligencia-artificial",
});

export default function ArtificialIntelligencePage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={serviceSchema(service)} />
      <Breadcrumbs items={breadcrumbs} />
      <ServiceHero
        eyebrow="Agentes de IA"
        title="IA nativa, conectada ao contexto de vendas."
        description={description}
        capabilities={[
          "Atendimento e qualificação pelo WhatsApp",
          "Conhecimento da organização via RAG",
          "Ações governadas por capacidades e regras",
          "Handoff para a equipe quando necessário",
        ]}
      />
      <section className={styles.sectionAlt} aria-labelledby="ai-operation">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="ai-operation">
              Agentes trabalham dentro da operação.
            </h2>
            <p className={styles.sectionCopy}>
              O agente interpreta mensagens e o contexto disponível, escolhe uma ação
              entre as capacidades configuradas e registra o andamento no CRM. A equipe
              permanece responsável pelas regras e pela transferência do atendimento.
            </p>
          </div>
          <ul className={styles.factList}>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>01</span>
              <span><strong>Contexto.</strong> Conversas, atividades e dados do lead acompanham o atendimento.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>02</span>
              <span><strong>Conhecimento.</strong> A busca RAG recupera conteúdo autorizado da organização.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>03</span>
              <span><strong>Guardrails.</strong> Regras antecedem a execução de ações pelo agente.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>04</span>
              <span><strong>Handoff.</strong> Pessoas podem assumir a conversa quando a operação exigir.</span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
