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

export default function HomePage() {
  return (
    <ReducedMotionProvider>
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
