import { Code2, HelpCircle, Server, Users } from "lucide-react";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "A Lumenva é open source e self-hosted: você executa a plataforma na sua própria infraestrutura, sem mensalidade por assento.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Preços", path: "/precos" },
] as const;
const service = { name: "Preços Lumenva", description } as const;

export const metadata = createPageMetadata({
  title: "Preços",
  description,
  path: "/precos",
});

export default function PrecosPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={serviceSchema(service)} />
      <Breadcrumbs items={breadcrumbs} />
      <ServiceHero
        eyebrow="Preços"
        title="Self-hosted, sem mensalidade por assento."
        description={description}
        capabilities={[
          { icon: Code2, label: "Código aberto sob licença MIT" },
          { icon: Server, label: "Execução na sua própria infraestrutura" },
          { icon: Users, label: "Sem limite artificial de usuários por plano" },
          { icon: HelpCircle, label: "Fale com a equipe para apoio de instalação" },
        ]}
      />
      <section className={styles.sectionAlt} aria-labelledby="pricing-model">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="pricing-model">
              Como funciona o modelo self-hosted.
            </h2>
            <p className={styles.sectionCopy}>
              A Lumenva não vende assinatura por usuário. O código é aberto e a
              plataforma roda na infraestrutura da sua operação. Os custos são os da
              sua própria hospedagem, e a equipe está disponível para apoiar a
              instalação e a configuração inicial.
            </p>
          </div>
          <ul className={styles.factList}>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>01</span>
              <span><strong>Open source.</strong> O código é distribuído sob licença MIT.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>02</span>
              <span><strong>Self-hosted.</strong> Você controla onde e como a plataforma roda.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>03</span>
              <span><strong>Sem vendor lock-in.</strong> Seus dados permanecem na sua infraestrutura.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>04</span>
              <span><strong>Apoio à instalação.</strong> Fale com a equipe para planejar a sua implantação.</span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
