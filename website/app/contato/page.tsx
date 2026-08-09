import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ProseFAQ } from "@/components/sections/ProseFAQ";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import type { FaqItem } from "@/content/faq";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Conheça a Lumenva e converse sobre agentes de IA, automações, CRM e self-hosting para a sua operação.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Contato", path: "/contato" },
] as const;
const contactFaq: readonly FaqItem[] = [
  {
    question: "O que é a Lumenva?",
    answer:
      "Lumenva é a identidade pública de um AI Sales OS open source e self-hosted para vendas e suporte pelo WhatsApp.",
  },
  {
    question: "Onde a plataforma é executada?",
    answer:
      "A Lumenva é self-hosted e pode ser executada na infraestrutura da própria operação.",
  },
  {
    question: "Qual é o canal principal?",
    answer:
      "O WhatsApp é o canal primário da Lumenva para operações de vendas e suporte.",
  },
];

export const metadata = createPageMetadata({
  title: "Solicitar demonstração",
  description,
  path: "/contato",
});

export default function ContactPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <JsonLd data={faqSchema(contactFaq)} />
      <Breadcrumbs items={breadcrumbs} />
      <ServiceHero
        eyebrow="Demonstração"
        title="Veja a Lumenva aplicada à sua operação."
        description={description}
        capabilities={[
          "Agentes de IA",
          "Automações",
          "CRM",
          "Self-hosting",
        ]}
        ctaHref="#demonstracao"
      />
      <section className={styles.sectionAlt} id="demonstracao" aria-labelledby="demo-shell-title">
        <div className="site-shell">
          <div className={styles.contactShell}>
            <h2 className={styles.sectionTitle} id="demo-shell-title">
              Solicitação de demonstração
            </h2>
            <p className={styles.sectionCopy}>
              Conte um pouco sobre a operação. O envio será habilitado quando a
              integração segura de demonstrações estiver configurada.
            </p>
            <form
              className={styles.form}
              aria-labelledby="demo-shell-title"
              aria-describedby="demo-form-status"
            >
              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span className={styles.label}>Nome</span>
                  <input
                    className={styles.input}
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Empresa</span>
                  <input
                    className={styles.input}
                    name="company"
                    type="text"
                    autoComplete="organization"
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>E-mail</span>
                  <input
                    className={styles.input}
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>WhatsApp</span>
                  <input
                    className={styles.input}
                    name="whatsapp"
                    type="tel"
                    autoComplete="tel"
                    required
                  />
                </label>
              </div>
              <label className={styles.consent}>
                <input name="consent" type="checkbox" required />
                <span>Autorizo o contato da equipe sobre a demonstração solicitada.</span>
              </label>
              <button className={styles.submit} type="submit" disabled>
                Solicitar demonstração
              </button>
              <p className={`${styles.sectionCopy} ${styles.formNote}`} id="demo-form-status">
                Envio temporariamente indisponível. Nenhum dado preenchido é coletado
                por esta versão.
              </p>
            </form>
          </div>
        </div>
      </section>
      <ProseFAQ
        title="Perguntas sobre a plataforma"
        description="Respostas diretas sobre o modelo da Lumenva."
        items={contactFaq}
      />
    </>
  );
}
