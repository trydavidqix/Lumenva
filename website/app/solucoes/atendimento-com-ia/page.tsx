import { Clock, Clock3, Heart, History, Sparkles, Users2, Zap } from "lucide-react";
import { AtendimentoMockup } from "@/components/sections/AtendimentoMockup";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";
import { JsonLd } from "@/components/ui/JsonLd";
import { FeatureCardGrid } from "@/components/ui/FeatureCardGrid";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Centralize conversas de todos os canais, responda mais rápido com IA, qualifique pedidos automaticamente e transfira para a sua equipa humana sempre que necessário.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Soluções", path: "/solucoes" },
  { name: "Atendimento com IA", path: "/solucoes/atendimento-com-ia" },
] as const;
const service = { name: "Atendimento com IA Lumenva", description } as const;

const benefits = [
  { icon: Clock3, title: "Atenda 24/7", description: "Responda a clientes a qualquer hora, em todos os canais." },
  { icon: Zap, title: "Reduza o tempo de resposta", description: "A IA responde instantaneamente às perguntas mais comuns." },
  { icon: History, title: "Mantenha histórico completo", description: "Todas as interações centralizadas com contexto e histórico." },
  { icon: Heart, title: "Aumente a satisfação do cliente", description: "Respostas rápidas, precisas e o toque humano quando mais importa." },
] as const;

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
          { icon: WhatsAppIcon, label: "WhatsApp centralizado" },
          { icon: Sparkles, label: "Respostas automáticas" },
          { icon: Users2, label: "Handoff inteligente" },
          { icon: Clock, label: "Contexto completo" },
        ]}
        visual={<AtendimentoMockup />}
      />
      <section className={styles.cardsSection} aria-label="Benefícios do atendimento com IA">
        <div className="site-shell">
          <FeatureCardGrid ariaLabel="Benefícios do atendimento com IA" items={benefits} />
        </div>
      </section>
      <section className={styles.sectionAlt} aria-labelledby="attendance-model">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="attendance-model">
              Contexto para responder rápido e com propriedade.
            </h2>
            <p className={styles.sectionCopy}>
              Cada conversa chega com resumo, intenção e prioridade. O agente sugere a
              próxima resposta a partir do contexto do lead; a equipa revê, ajusta ou
              assume o atendimento a qualquer momento.
            </p>
          </div>
          <ul className={styles.factList}>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>01</span>
              <span><strong>Inbox unificada.</strong> Todas as conversas de WhatsApp num único lugar.</span>
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
