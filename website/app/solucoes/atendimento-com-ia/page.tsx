import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Uma inbox de WhatsApp com resumo da conversa, intenção, contexto e prioridade, para agentes de IA sugerirem respostas e a equipe assumir quando necessário.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Soluções", path: "/solucoes" },
  { name: "Atendimento com IA", path: "/solucoes/atendimento-com-ia" },
] as const;
const service = { name: "Atendimento com IA Lumenva", description } as const;

export const metadata = createPageMetadata({
  title: "Atendimento com IA",
  description,
  path: "/solucoes/atendimento-com-ia",
});

export default function AtendimentoComIaPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={serviceSchema(service)} />
      <Breadcrumbs items={breadcrumbs} />
      <ServiceHero
        eyebrow="Atendimento com IA"
        title="Automatize o atendimento sem perder o toque humano."
        description={description}
        capabilities={[
          "Atenda 24/7 pelo WhatsApp",
          "Reduza o tempo de resposta",
          "Mantenha o histórico completo da conversa",
          "Aumente a satisfação com handoff claro para a equipe",
        ]}
      />
      <section className={styles.sectionAlt} aria-labelledby="attendance-model">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="attendance-model">
              Contexto para responder rápido e com propriedade.
            </h2>
            <p className={styles.sectionCopy}>
              Cada conversa chega com resumo, intenção e prioridade. O agente sugere a
              próxima resposta a partir do contexto do lead; a equipe revisa, ajusta ou
              assume o atendimento a qualquer momento.
            </p>
          </div>
          <ul className={styles.factList}>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>01</span>
              <span><strong>Inbox unificada.</strong> Todas as conversas de WhatsApp em um único lugar.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>02</span>
              <span><strong>Resumo e intenção.</strong> A IA sintetiza o pedido do contacto para agilizar a resposta.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>03</span>
              <span><strong>Resposta sugerida.</strong> O agente propõe a próxima mensagem com base no histórico.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>04</span>
              <span><strong>Handoff.</strong> A transferência para uma pessoa preserva todo o contexto já reunido.</span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
