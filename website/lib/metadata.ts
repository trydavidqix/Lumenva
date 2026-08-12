import type { Metadata } from "next";
import { site } from "@/content/site";

export type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
};

export function getSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (configuredUrl) {
    return new URL(configuredUrl);
  }

  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    return new URL("http://localhost:3100");
  }

  throw new Error("NEXT_PUBLIC_SITE_URL is required outside local development.");
}

export function createPageMetadata({ title, description, path }: PageMetadataInput): Metadata {
  const url = new URL(path, getSiteUrl());

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: site.siteName,
      locale: "pt_PT",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}
