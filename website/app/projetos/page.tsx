import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Casos aprovados e verificáveis da Lumenva serão publicados aqui quando estiverem disponíveis.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Projetos", path: "/projetos" },
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
        title="Resultados publicados com evidência."
        description={description}
        capabilities={[
          "Somente casos aprovados",
          "Resultados verificáveis",
          "Nenhum depoimento ou métrica fabricada",
        ]}
      />
      <section className={styles.sectionAlt} aria-labelledby="projects-status">
        <div className={`site-shell reading-measure ${styles.sectionHeader}`}>
          <h2 className={styles.sectionTitle} id="projects-status">
            Ainda não há estudos de caso publicados.
          </h2>
          <p className={styles.sectionCopy}>
            A Lumenva não publica logos, depoimentos, números ou histórias sem
            aprovação e fonte verificável. Os primeiros estudos de caso aparecerão
            nesta página quando esse material estiver autorizado.
          </p>
        </div>
      </section>
    </>
  );
}
