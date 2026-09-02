import { Robot, Database, Lightning } from "@phosphor-icons/react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { WhatsAppIcon } from "@/components/ui/BrandIcons";
import { JsonLd } from "@/components/ui/JsonLd";
import { solutionsMenu } from "@/content/site";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Conheça como agentes de IA, automações e CRM trabalham juntos na mesma operação.";
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
        title="Quatro soluções, um único sistema."
        description={description}
        capabilities={[
          { icon: Robot, label: "Agentes de IA para vendas e suporte" },
          { icon: Lightning, label: "Automações orientadas por eventos" },
          { icon: Database, label: "CRM com contexto de conversas e pipeline" },
          { icon: WhatsAppIcon, label: "WhatsApp como canal principal" },
        ]}
      />
      <section className={styles.cardsSection} aria-labelledby="solutions-directory">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="solutions-directory">
              As quatro soluções da Lumenva.
            </h2>
            <p className={styles.sectionCopy}>
              Cada solução pode ser adotada de forma independente e partilha o
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
    </>
  );
}
