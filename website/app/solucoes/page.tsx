import { Bot, Database, Server, Zap } from "lucide-react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { solutionsMenu } from "@/content/site";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Conheça como agentes de IA, automações e CRM trabalham juntos em uma operação open source e self-hosted.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Soluções", path: "/solucoes" },
] as const;
const service = { name: "Soluções Lumenva", description } as const;

export const metadata = createPageMetadata({
  title: "Soluções",
  description,
  path: "/solucoes",
});

export default function SolutionsPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={serviceSchema(service)} />
      <Breadcrumbs items={breadcrumbs} />
      <ServiceHero
        eyebrow="Soluções"
        title="IA, automação e CRM na mesma operação."
        description={description}
        capabilities={[
          { icon: Bot, label: "Agentes de IA para vendas e suporte" },
          { icon: Zap, label: "Automações orientadas por eventos" },
          { icon: Database, label: "CRM com contexto de conversas e pipeline" },
          { icon: Server, label: "Execução na sua própria infraestrutura" },
        ]}
      />
      <section aria-labelledby="solutions-directory">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="solutions-directory">
              As quatro soluções da Lumenva.
            </h2>
            <p className={styles.sectionCopy}>
              Cada solução pode ser adotada de forma independente e compartilha o
              mesmo contexto de conversas, leads e pipeline.
            </p>
          </div>
          <ul className={styles.factList}>
            {solutionsMenu.map((item, index) => (
              <li key={item.href}>
                <Link className={styles.solutionCard} href={item.href}>
                  <span className={styles.capabilityIndex}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span className={styles.factTitle}>{item.label}.</span>{" "}
                    <span className={styles.sectionCopy}>{item.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className={styles.sectionAlt} aria-labelledby="solutions-foundation">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="solutions-foundation">
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
