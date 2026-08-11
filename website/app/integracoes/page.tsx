import { Code2, MessageCircle, ShoppingBag, Webhook } from "lucide-react";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { FeatureCardGrid } from "@/components/ui/FeatureCardGrid";
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

const integrationCards = [
  { icon: MessageCircle, title: "WhatsApp", description: "Canal primário de vendas e suporte, conectado pelo WAHA." },
  { icon: ShoppingBag, title: "Nuvemshop", description: "Integração documentada para pedidos, clientes e catálogo." },
  { icon: Webhook, title: "Webhooks", description: "Eventos externos podem entrar e sair por endpoints dedicados." },
  { icon: Code2, title: "API REST", description: "Recursos do CRM são expostos por uma API versionada." },
] as const;

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
          { icon: MessageCircle, label: "WhatsApp conectado pelo WAHA" },
          { icon: ShoppingBag, label: "Nuvemshop para pedidos, clientes e catálogo" },
          { icon: Webhook, label: "Webhooks de entrada e saída" },
          { icon: Code2, label: "API REST versionada" },
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
          <FeatureCardGrid ariaLabel="Integrações documentadas" items={integrationCards} />
        </div>
      </section>
    </>
  );
}
