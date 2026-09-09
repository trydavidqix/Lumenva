import type { FaqItem } from "@/content/faq";
import type { AgencyService } from "@/content/agency-services";
import type { Service } from "@/content/services";
import { contactDetails, site, socialLinks } from "@/content/site";
import { getSiteUrl } from "@/lib/metadata";

type JsonLdRecord = Record<string, unknown>;

export type BreadcrumbItem = {
  name: string;
  path: string;
};

export type OrganizationSchema = JsonLdRecord & {
  "@context": "https://schema.org";
  "@type": "Organization";
  name: string;
  description: string;
  url: string;
  email: string;
  telephone: string;
  sameAs: string[];
};

export type WebsiteSchema = JsonLdRecord & {
  "@context": "https://schema.org";
  "@type": "WebSite";
  name: string;
  description: string;
  url: string;
};

export type ServiceSchema = JsonLdRecord & {
  "@context": "https://schema.org";
  "@type": "Service";
  name: string;
  description: string;
  provider: { "@type": "Organization"; name: string };
};

export type AgencyServicesSchema = JsonLdRecord & {
  "@context": "https://schema.org";
  "@type": "ItemList";
  name: string;
  itemListElement: Array<{
    "@type": "Service";
    position: number;
    item: {
      "@type": "Service";
      name: string;
      description: string;
      provider: { "@type": "Organization"; name: string };
    };
  }>;
};

export type BreadcrumbSchema = JsonLdRecord & {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }>;
};

export type FaqSchema = JsonLdRecord & {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: Array<{
    "@type": "Question";
    name: string;
    acceptedAnswer: { "@type": "Answer"; text: string };
  }>;
};

export function organizationSchema(): OrganizationSchema {
  const url = getSiteUrl().toString();

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.siteName,
    description: site.description,
    url,
    email: contactDetails.email,
    telephone: contactDetails.phone.replace(/\s+/g, ""),
    sameAs: socialLinks.map((social) => social.href),
  };
}

export function websiteSchema(): WebsiteSchema {
  const url = getSiteUrl().toString();

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.siteName,
    description: site.description,
    url,
  };
}

export function serviceSchema(service: Service): ServiceSchema {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.description,
    provider: {
      "@type": "Organization",
      name: site.siteName,
    },
  };
}

export function agencyServicesSchema(services: readonly AgencyService[]): AgencyServicesSchema {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Serviços da Lumenva",
    itemListElement: services.map((service, index) => ({
      "@type": "Service",
      position: index + 1,
      item: {
        "@type": "Service",
        name: service.name,
        description: service.description,
        provider: {
          "@type": "Organization",
          name: site.siteName,
        },
      },
    })),
  };
}

export function breadcrumbSchema(items: readonly BreadcrumbItem[]): BreadcrumbSchema {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.path, siteUrl).toString(),
    })),
  };
}

export function faqSchema(items: readonly FaqItem[]): FaqSchema {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
