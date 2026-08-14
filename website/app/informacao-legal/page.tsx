import { Breadcrumbs } from "@/components/sections/Breadcrumbs";
import { LegalContent, LegalHero } from "@/components/sections/LegalContent";
import { JsonLd } from "@/components/ui/JsonLd";
import { legalInfoPage } from "@/content/legal";
import { createPageMetadata } from "@/lib/metadata";
import { breadcrumbSchema } from "@/lib/schema";

const breadcrumbs = [
  { name: "Início", path: "/" },
  { name: legalInfoPage.title, path: "/informacao-legal" },
] as const;

export const metadata = createPageMetadata({
  title: legalInfoPage.title,
  description: legalInfoPage.metaDescription,
  path: "/informacao-legal",
});

export default function InformacaoLegalPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumbs)} />
      <Breadcrumbs items={breadcrumbs} />
      <LegalHero page={legalInfoPage} />
      <LegalContent page={legalInfoPage} />
    </>
  );
}
