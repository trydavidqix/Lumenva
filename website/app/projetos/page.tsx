import { Globe, Smartphone, Database } from "lucide-react";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { FeatureCardGrid } from "@/components/ui/FeatureCardGrid";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Serviços de desenvolvimento sob medida da Lumenva, à parte da plataforma de atendimento e vendas com IA: sites, aplicações e implementação de CRM.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Projetos", path: "/projetos" },
] as const;

const projectCards = [
  { icon: Globe, title: "Criação de sites", description: "Sites institucionais e páginas de conversão construídos sob medida." },
  { icon: Smartphone, title: "Aplicações móveis", description: "Aplicações nativas e multiplataforma para a sua operação." },
  { icon: Database, title: "CRM", description: "Implementação e personalização do CRM para vendas e atendimento." },
] as const;

export const metadata = createPageMetadata({
  title: "Projetos",
  description,
  path: "/projetos",
});

export default function ProjectsPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <Breadcrumbs items={breadcrumbs} />
      <ServiceHero
        eyebrow="Projetos"
        title="Sites, aplicações e CRM sob medida."
        description={description}
        capabilities={[
          { icon: Globe, label: "Criação de sites" },
          { icon: Smartphone, label: "Aplicações móveis" },
          { icon: Database, label: "CRM" },
        ]}
      />
      <section className={styles.cardsSectionEnd} aria-label="Projetos oferecidos">
        <div className="site-shell">
          <FeatureCardGrid ariaLabel="Projetos oferecidos" items={projectCards} />
        </div>
      </section>
    </>
  );
}
