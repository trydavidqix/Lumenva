import { PrivacyPolicy } from "@/components/sections/PrivacyPolicy";
import { JsonLd } from "@/components/ui/JsonLd";
import { privacyPolicyPage } from "@/content/legal";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema } from "@/lib/schema";

const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: privacyPolicyPage.title, path: "/politica-de-privacidade" },
] as const;

export const metadata = createPageMetadata({
  title: privacyPolicyPage.title,
  description: privacyPolicyPage.metaDescription,
  path: "/politica-de-privacidade",
});

export default function PoliticaDePrivacidadePage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <PrivacyPolicy page={privacyPolicyPage} />
    </>
  );
}
