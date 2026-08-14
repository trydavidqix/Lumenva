import type { Metadata } from "next";
import { ReducedMotionProvider } from "@/components/motion/ReducedMotionProvider";
import {
  AgentNarrative,
  CapabilityOverview,
  CapabilitySections,
} from "@/components/sections/CapabilityNarrative";
import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { IntegrationStrip } from "@/components/sections/IntegrationStrip";
import { ProofBand } from "@/components/sections/ProofBand";
import { JsonLd } from "@/components/ui/JsonLd";
import { faqItems } from "@/content/faq";
import {
  agentNarrativeSteps,
  capabilitySections,
  finalCtaItems,
  howItWorksSteps,
  integrationItems,
  proofPoints,
} from "@/content/home";
import { services } from "@/content/services";
import { getSiteUrl } from "@/lib/metadata";
import { organizationSchema, websiteSchema } from "@/lib/schema";

export const metadata: Metadata = {
  alternates: {
    canonical: new URL("/", getSiteUrl()),
  },
  openGraph: {
    url: new URL("/", getSiteUrl()),
  },
};

export default function HomePage() {
  return (
    <ReducedMotionProvider>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={websiteSchema()} />
      <Hero />
      <ProofBand items={proofPoints} />
      <CapabilityOverview items={services} />
      <AgentNarrative steps={agentNarrativeSteps} />
      <CapabilitySections sections={capabilitySections} />
      <HowItWorks steps={howItWorksSteps} />
      <IntegrationStrip items={integrationItems} />
      <FAQ items={faqItems} />
      <FinalCTA items={finalCtaItems} />
    </ReducedMotionProvider>
  );
}
