import { notFound } from "next/navigation";
import { publicRoutes } from "@/content/site";

export interface PublicRoutePageProps {
  readonly params: Promise<{
    slug: string;
  }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return publicRoutes.map(({ slug }) => ({ slug }));
}

export default async function PublicRoutePage({
  params,
}: Readonly<PublicRoutePageProps>) {
  const { slug } = await params;
  const route = publicRoutes.find((item) => item.slug === slug);

  if (!route) notFound();

  return (
    <section className="section" aria-labelledby="route-title">
      <div className="site-shell reading-measure">
        <h1 id="route-title">{route.heading}</h1>
        <p>{route.description}</p>
      </div>
    </section>
  );
}
