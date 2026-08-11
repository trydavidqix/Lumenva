import { Sparkles } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { SiN8N, SiSupabase, SiVercel } from "react-icons/si";
import { heroIntegrations, homeContent } from "@/content/home";
import { demoCta } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { HeroProductMockup } from "@/components/sections/HeroProductMockup";
import styles from "./Hero.module.css";

type IntegrationIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const INTEGRATION_ICONS: Record<(typeof heroIntegrations)[number], IntegrationIcon> = {
  WhatsApp: FaWhatsapp,
  OpenAI: Sparkles,
  n8n: SiN8N,
  Supabase: SiSupabase,
  Vercel: SiVercel,
};

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={`site-shell ${styles.layout}`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{homeContent.eyebrow}</p>
          <h1 id="hero-title" className={styles.title}>
            {homeContent.title}
          </h1>
          <p className={styles.description}>{homeContent.description}</p>
          <div className={styles.actions}>
            <Button className={styles.primaryAction} href={demoCta.href} magnetic variant="primary">
              {demoCta.label}
            </Button>
            <Button
              className={styles.secondaryAction}
              href={homeContent.secondaryCta.href}
              variant="secondary"
            >
              {homeContent.secondaryCta.label}
            </Button>
          </div>
          <p className={styles.integrationsLabel}>Compatível com as ferramentas que já usa</p>
          <ul className={styles.integrations}>
            {heroIntegrations.map((name) => {
              const Icon = INTEGRATION_ICONS[name];
              return (
                <li className={styles.integrationPill} key={name}>
                  <Icon aria-hidden="true" size={16} />
                  {name}
                </li>
              );
            })}
          </ul>
        </div>

        <div className={styles.previewStage}>
          <HeroProductMockup />
        </div>
      </div>
    </section>
  );
}
