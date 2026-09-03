import type { ComponentType, SVGProps } from "react";
import { heroIntegrations, homeContent } from "@/content/home";
import { demoCta } from "@/content/site";
import { Button } from "@/components/ui/Button";
import { HeroProductMockup } from "@/components/sections/HeroProductMockup";
import {
  ClaudeIcon,
  N8nIcon,
  OpenAIIcon,
  SupabaseIcon,
  VercelIcon,
  WhatsAppIcon,
} from "@/components/ui/BrandIcons";
import styles from "./Hero.module.css";

type IntegrationIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const INTEGRATION_ICONS: Record<(typeof heroIntegrations)[number], IntegrationIcon> = {
  WhatsApp: WhatsAppIcon,
  OpenAI: OpenAIIcon,
  Claude: ClaudeIcon,
  n8n: N8nIcon,
  Supabase: SupabaseIcon,
  Vercel: VercelIcon,
};

const WORDMARK_LOGOS = new Set<(typeof heroIntegrations)[number]>(["OpenAI", "Supabase", "Vercel"]);

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
            <Button href={demoCta.href} magnetic variant="primary">
              {demoCta.label}
            </Button>
            <Button
              href={homeContent.secondaryCta.href}
              variant="secondary"
            >
              {homeContent.secondaryCta.label}
            </Button>
          </div>
          <p className={styles.integrationsLabel}>Empresas com que trabalhamos</p>
          <ul className={styles.integrations}>
            {heroIntegrations.map((name) => {
              const Icon = INTEGRATION_ICONS[name];
              const isWordmark = WORDMARK_LOGOS.has(name);
              return (
                <li className={styles.integrationPill} key={name}>
                  <Icon aria-hidden="true" size={16} />
                  <span className={isWordmark ? "visually-hidden" : undefined}>{name}</span>
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
