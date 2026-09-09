import { expect, test } from "vitest";
import { site } from "@/content/site";
import { agencyServices } from "@/content/agency-services";
import { createPageMetadata } from "@/lib/metadata";
import {
  breadcrumbSchema,
  faqSchema,
  agencyServicesSchema,
  organizationSchema,
  serviceSchema,
  websiteSchema,
} from "@/lib/schema";

test("organization schema identifies Lumenva with real published contact data only", () => {
  const schema = organizationSchema();

  expect(schema["@type"]).toBe("Organization");
  expect(schema.name).toBe("Lumenva");
  expect(schema.email).toBe("contato@lumenva.pt");
  expect(schema.telephone).toBe("+351910293287");
  expect(schema.sameAs).toEqual([
    "https://wa.me/351910293287",
    "https://www.facebook.com/profile.php?id=61592131762439",
    "https://www.instagram.com/lumenva.group/",
  ]);
  // No structured postal address: only "Porto" is public, not a full street/postal code.
  expect(schema).not.toHaveProperty("address");
});

test("website schema describes the public product site", () => {
  const schema = websiteSchema();

  expect(schema["@type"]).toBe("WebSite");
  expect(schema.name).toBe(site.siteName);
  expect(schema.url).toBe("http://localhost:3100/");
});

test("service schema preserves the supplied visible service facts", () => {
  const schema = serviceSchema({
    name: "Agentes de IA",
    description: "Atendem, qualificam e movem leads no funil pelo WhatsApp.",
  });

  expect(schema).toMatchObject({
    "@type": "Service",
    name: "Agentes de IA",
    description: "Atendem, qualificam e movem leads no funil pelo WhatsApp.",
  });
  expect(schema).not.toHaveProperty("offers");
});

test("agency services schema publishes all seven services without commercial offer fields", () => {
  const schema = agencyServicesSchema(agencyServices);

  expect(schema["@type"]).toBe("ItemList");
  expect(schema.itemListElement).toHaveLength(7);
  expect(schema.itemListElement.map(({ item }) => item.name)).toEqual(agencyServices.map(({ name }) => name));

  for (const entry of schema.itemListElement) {
    expect(entry.item.provider).toEqual({ "@type": "Organization", name: "Lumenva" });
    expect(entry.item).not.toHaveProperty("price");
    expect(entry.item).not.toHaveProperty("priceCurrency");
    expect(entry.item).not.toHaveProperty("offers");
    expect(entry).not.toHaveProperty("price");
    expect(entry).not.toHaveProperty("priceCurrency");
    expect(entry).not.toHaveProperty("offers");
  }
});

test("breadcrumb schema uses the supplied visible hierarchy", () => {
  const schema = breadcrumbSchema([
    { name: "Início", path: "/" },
    { name: "Serviços", path: "/servicos" },
  ]);

  expect(schema.itemListElement).toEqual([
    {
      "@type": "ListItem",
      position: 1,
      name: "Início",
      item: "http://localhost:3100/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Serviços",
      item: "http://localhost:3100/servicos",
    },
  ]);
});

test("FAQ schema mirrors visible questions", () => {
  const json = faqSchema([
    { question: "O que é a Lumenva?", answer: "Resposta factual." },
  ]);

  expect(json.mainEntity[0]?.name).toBe("O que é a Lumenva?");
  expect(json.mainEntity[0]?.acceptedAnswer.text).toBe("Resposta factual.");
});

test("page metadata creates canonical, Open Graph, and Twitter fields", () => {
  const metadata = createPageMetadata({
    title: "Serviços",
    description: "Descrição factual.",
    path: "/servicos",
  });

  expect(metadata.alternates?.canonical?.toString()).toBe("http://localhost:3100/servicos");
  expect(metadata.openGraph).toMatchObject({
    title: "Serviços",
    description: "Descrição factual.",
    siteName: "Lumenva",
  });
  expect(metadata.openGraph?.url?.toString()).toBe("http://localhost:3100/servicos");
  expect(metadata.twitter).toMatchObject({
    card: "summary",
    title: "Serviços",
    description: "Descrição factual.",
  });
});
