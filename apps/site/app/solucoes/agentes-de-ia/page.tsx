import { ChartBar, BookOpen, ShieldCheck, User, Lightning } from "@phosphor-icons/react/ssr";
import { AgentesMockup } from "@/components/sections/AgentesMockup";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { FeatureCardGrid } from "@/components/ui/FeatureCardGrid";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Treine agentes com contexto do seu negócio, defina funções específicas e acompanhe o desempenho em tempo real. Atendimento, vendas e operações num só sistema.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Soluções", path: "/solucoes" },
  { name: "Agentes de IA", path: "/solucoes/agentes-de-ia" },
] as const;
const service = { name: "Agentes de IA Lumenva", description } as const;

const benefits = [
  { icon: BookOpen, title: "Treine com o seu contexto", description: "Use documentos, FAQs, CRM e histórico de conversas para orientar cada agente." },
  { icon: User, title: "Especialize por função", description: "Tenha agentes dedicados para vendas, suporte, cobrança e operação." },
  { icon: ShieldCheck, title: "Automatize com controlo", description: "Defina regras, aprovações e handoff para manter qualidade e segurança." },
  { icon: ChartBar, title: "Acompanhe desempenho", description: "Veja métricas, histórico e resultados de cada agente em tempo real." },
] as const;

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
        eyebrow="Solução · Agentes de IA"
        title="Crie agentes de IA que atendem, qualificam e executam tarefas por si."
        description={description}
        capabilities={[
          { icon: User, label: "Agentes especializados" },
          { icon: BookOpen, label: "Base de conhecimento" },
          { icon: Lightning, label: "Ações automáticas" },
          { icon: ShieldCheck, label: "Supervisão humana" },
        ]}
        visual={<AgentesMockup />}
      />
      <section className={styles.cardsSection} aria-label="Benefícios dos agentes de IA">
        <div className="site-shell">
          <FeatureCardGrid ariaLabel="Benefícios dos agentes de IA" items={benefits} />
        </div>
      </section>
      <section className={styles.sectionAlt} aria-labelledby="ai-operation">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="ai-operation">
              Agentes trabalham dentro da operação, não ao lado dela.
            </h2>
            <p className={styles.sectionCopy}>
              O agente interpreta mensagens e o contexto disponível, escolhe uma ação
              entre as capacidades configuradas e regista o andamento no CRM. A equipa
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
              <span><strong>Supervisão e handoff.</strong> A equipa acompanha o desempenho e pode assumir a conversa quando necessário.</span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
