import { Magnet } from "@phosphor-icons/react";
import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { JsonLd } from "@/components/ui/JsonLd";
import { FeatureCardGrid } from "@/components/ui/FeatureCardGrid";
import { GoogleIcon, N8nIcon, WhatsAppIcon } from "@/components/ui/BrandIcons";
import {
  GoogleCalendarIcon,
  GoogleChatIcon,
  GoogleDriveIcon,
  GoogleFormsIcon,
  GoogleMeetIcon,
} from "@/components/ui/GoogleAppIcons";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import styles from "@/components/sections/InnerPages.module.css";

const description =
  "Conecte canais de atendimento, captação, agenda e ferramentas de operação documentadas pela plataforma.";
const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: "Integrações", path: "/integracoes" },
] as const;
const service = { name: "Integrações Lumenva", description } as const;

const integrationCards = [
  { icon: WhatsAppIcon, title: "Atendimento", description: "WhatsApp, Instagram Direct, Facebook Messenger, Telegram, Gmail, Outlook." },
  { icon: Magnet, title: "Captação", description: "Facebook Lead Ads, Instagram Ads, TikTok Lead Gen, Google Ads Lead Forms, landing pages." },
  { icon: GoogleCalendarIcon, title: "Agenda", description: "Google Calendar, Outlook Calendar, Calendly." },
  { icon: GoogleIcon, title: "Google", description: "Google Sheets, Drive, Gmail, Calendar, Contacts, Ads." },
  { icon: GoogleFormsIcon, title: "Formulários", description: "Typeform, Tally, Jotform, Google Forms." },
  { icon: GoogleDriveIcon, title: "Ficheiros", description: "Google Drive, OneDrive, Dropbox." },
  { icon: GoogleChatIcon, title: "Contratos", description: "Clicksign." },
  { icon: N8nIcon, title: "Automação", description: "n8n." },
  { icon: GoogleMeetIcon, title: "Reuniões", description: "Google Meet, Zoom, Microsoft Teams." },
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
          { icon: WhatsAppIcon, label: "Atendimento" },
          { icon: Magnet, label: "Captação" },
          { icon: GoogleCalendarIcon, label: "Agenda" },
          { icon: N8nIcon, label: "Automação" },
        ]}
      />
      <section className={styles.sectionAlt} aria-labelledby="documented-integrations">
        <div className={`site-shell ${styles.sectionStack}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="documented-integrations">
              Integrações confirmadas pelo produto.
            </h2>
            <p className={styles.sectionCopy}>
              Esta página apresenta apenas canais e integrações documentados. Novos
              conectores serão incluídos quando estiverem disponíveis no produto.
            </p>
          </div>
          <FeatureCardGrid ariaLabel="Integrações documentadas" items={integrationCards} />
        </div>
      </section>
    </>
  );
}
