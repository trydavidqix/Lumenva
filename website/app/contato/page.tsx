import { Bot, Database, MessageCircle, Zap } from "lucide-react";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ContactForm } from "@/components/sections/ContactForm";
import { ProseFAQ } from "@/components/sections/ProseFAQ";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import type { FaqItem } from "@/content/faq";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, faqSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Conheça a Lumenva e converse sobre agentes de IA, automações e CRM para a sua operação.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Contato", path: "/contato" },
] as const;
const contactFaq: readonly FaqItem[] = [
  {
    question: "O que é a Lumenva?",
    answer:
      "Lumenva é uma plataforma de atendimento e vendas com IA que une agentes, automações e CRM num só sistema.",
  },
  {
    question: "Como funcionam os agentes de IA?",
    answer:
      "Os agentes atendem e qualificam com o contexto da sua operação, seguindo regras definidas pela sua equipa.",
  },
  {
    question: "Qual é o canal principal?",
    answer:
      "O WhatsApp é o canal primário da Lumenva para operações de vendas e suporte.",
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
          { icon: Bot, label: "Agentes de IA" },
          { icon: Zap, label: "Automações" },
          { icon: Database, label: "CRM" },
          { icon: MessageCircle, label: "WhatsApp" },
        ]}
        ctaHref="#demonstracao"
      />
      <section className={styles.sectionAlt} id="demonstracao" aria-labelledby="demo-shell-title">
        <div className="site-shell">
          <div className={styles.contactShell}>
            <h2 className={styles.sectionTitle} id="demo-shell-title">
              Entre em contato
            </h2>
            <p className={styles.sectionCopy}>
              Conte o que você está buscando. Nossa equipe retorna para entender
              o contexto e apresentar a melhor forma de aplicar a Lumenva.
            </p>
            <ContactForm />
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
