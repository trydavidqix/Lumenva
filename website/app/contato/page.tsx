import { Robot, Database } from "@phosphor-icons/react";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ContactForm } from "@/components/sections/ContactForm";
import { ContactInfoCard } from "@/components/sections/ContactInfoCard";
import { ProseFAQ } from "@/components/sections/ProseFAQ";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { N8nIcon, WhatsAppIcon } from "@/components/ui/BrandIcons";
import { JsonLd } from "@/components/ui/JsonLd";
import type { FaqItem } from "@/content/faq";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Conheça a Lumenva e converse sobre agentes de IA, automações e CRM para a sua operação.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Contacto", path: "/contato" },
] as const;
const contactFaq: readonly FaqItem[] = [
  {
    question: "Como funciona a demonstração?",
    answer:
      "Preenche o formulário e a nossa equipa entra em contacto para perceber o contexto da sua operação e mostrar a Lumenva aplicada ao seu caso.",
  },
  {
    question: "Que informação preciso de dar?",
    answer:
      "Nome, empresa, e-mail e WhatsApp. A mensagem é opcional, mas ajuda a preparar a conversa.",
  },
  {
    question: "Os meus dados ficam seguros?",
    answer:
      "Sim. Os dados enviados são usados apenas para responder ao seu pedido, conforme a nossa Política de Privacidade.",
  },
];

export const metadata = createPageMetadata({
  title: "Agendar demonstração",
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
        title="Vamos conversar sobre a sua operação."
        description={description}
        capabilities={[
          { icon: Robot, label: "Agentes de IA" },
          { icon: N8nIcon, label: "Automações" },
          { icon: Database, label: "CRM" },
          { icon: WhatsAppIcon, label: "WhatsApp" },
        ]}
        ctaHref="#demonstracao"
      />
      <section className={styles.sectionAlt} id="demonstracao" aria-labelledby="demo-shell-title">
        <div className={`site-shell ${styles.contactLayout}`}>
          <div className={styles.contactShell}>
            <h2 className={styles.sectionTitle} id="demo-shell-title">
              Entre em contacto
            </h2>
            <p className={styles.sectionCopy}>
              Diga-nos o que procura. A nossa equipa entra em contacto para perceber
              o contexto e mostrar a melhor forma de aplicar a Lumenva.
            </p>
            <ContactForm />
          </div>
          <ContactInfoCard />
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
