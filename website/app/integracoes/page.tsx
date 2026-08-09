import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Conecte o canal principal de atendimento e a integração de e-commerce documentada pela plataforma.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Integrações", path: "/integracoes" },
] as const;
const service = { name: "Integrações Lumenva", description } as const;

export const metadata = createPageMetadata({
  title: "Integrações",
  description,
  path: "/integracoes",
});

export default function IntegrationsPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={serviceSchema(service)} />
      <Breadcrumbs items={breadcrumbs} />
      <ServiceHero
        eyebrow="Integrações"
        title="Canais e dados ligados à operação."
        description={description}
        capabilities={[
          "WhatsApp conectado pelo WAHA",
          "Nuvemshop para pedidos, clientes e catálogo",
          "Webhooks de entrada e saída",
          "API REST versionada",
        ]}
      />
      <section className={styles.sectionAlt} aria-labelledby="documented-integrations">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="documented-integrations">
              Integrações confirmadas pelo produto.
            </h2>
            <p className={styles.sectionCopy}>
              Esta página apresenta somente canais e integrações documentados. Novos
              conectores serão incluídos quando estiverem disponíveis no produto.
            </p>
          </div>
          <ul className={styles.factList}>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>01</span>
              <span><strong>WhatsApp.</strong> Canal primário de vendas e suporte, conectado pelo WAHA.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>02</span>
              <span><strong>Nuvemshop.</strong> Integração documentada para pedidos, clientes e catálogo.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>03</span>
              <span><strong>Webhooks.</strong> Eventos externos podem entrar e sair por endpoints dedicados.</span>
            </li>
            <li className={styles.factItem}>
              <span className={styles.capabilityIndex}>04</span>
              <span><strong>API.</strong> Recursos do CRM são expostos por uma API REST versionada.</span>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
