import type { Metadata } from "next";
import { site } from "@/content/site";

export type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  robots?: Metadata["robots"];
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

export function createPageMetadata({ title, description, path, robots }: PageMetadataInput): Metadata {
  const url = new URL(path, getSiteUrl());

  return {
    title,
    description,
    robots: robots ?? { index: true, follow: true },
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
      images: [{ url: "/opengraph-image" }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: ["/twitter-image"],
    },
  };
}
