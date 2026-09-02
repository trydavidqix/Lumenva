import { GitBranch, PuzzlePiece, ShieldCheck, TrendUp } from "@phosphor-icons/react";
import { AutomacaoMockup } from "@/components/sections/AutomacaoMockup";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { FeatureCardGrid } from "@/components/ui/FeatureCardGrid";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Crie fluxos inteligentes, ligue ferramentas, defina regras e reduza tarefas repetitivas. Automatize operações, aprovações e follow-ups num único sistema.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Soluções", path: "/solucoes" },
  { name: "Automação de Processos", path: "/solucoes/automacao-de-processos" },
] as const;
const service = { name: "Automação de Processos Lumenva", description } as const;

const benefits = [
  { icon: TrendUp, title: "Reduza tarefas manuais", description: "Automatize etapas repetitivas e liberte a equipa para trabalho de maior valor." },
  { icon: PuzzlePiece, title: "Ligue toda a operação", description: "Integre CRM, WhatsApp, formulários e processos internos num só fluxo." },
  { icon: ShieldCheck, title: "Mantenha controlo e segurança", description: "Defina condições, aprovações e handoff humano sempre que necessário." },
  { icon: GitBranch, title: "Escala com consistência", description: "Execute processos com previsibilidade, rapidez e menos falhas operacionais." },
] as const;

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
        eyebrow="Solução · Automação de Processos"
        title="Automatize processos e escale a operação com mais controlo."
        description={description}
        capabilities={[
          { icon: GitBranch, label: "Fluxos visuais" },
          { icon: ShieldCheck, label: "Regras e condições" },
          { icon: PuzzlePiece, label: "Integrações ativas" },
          { icon: TrendUp, label: "Aprovação humana" },
        ]}
        visual={<AutomacaoMockup />}
      />
      <section className={styles.cardsSection} aria-labelledby="automation-benefits">
        <div className="site-shell">
          <FeatureCardGrid ariaLabel="Benefícios da automação de processos" items={benefits} />
        </div>
      </section>
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
              <span><strong>Execução.</strong> Workers processam os efeitos fora da transação da base de dados.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>04</span>
              <span><strong>Supervisão.</strong> A equipa configura regras, acompanha execuções e pode intervir.</span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
