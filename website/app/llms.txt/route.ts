import { getSiteUrl } from "@/lib/metadata";

export function GET() {
  const siteUrl = getSiteUrl();
  const link = (path: string) => new URL(path, siteUrl).toString();
  const sitemapUrl = link("/sitemap.xml");
  const body = `# Lumenva

Lumenva é uma plataforma de atendimento e vendas com IA que une agentes, automações e CRM, com o WhatsApp como canal principal.

## Secções principais

- Início: ${link("/")}
- Produto: ${link("/produto")} — agentes de IA, automações e CRM a trabalhar juntos.
- Soluções: ${link("/solucoes")} — soluções para vendas e suporte no WhatsApp.
- Integrações: ${link("/integracoes")} — integrações documentadas da plataforma.
- Serviços: ${link("/servicos")} — serviços de construção, conteúdo e aquisição para presença digital.
- Contacto: ${link("/contato")} — solicitar uma demonstração.

Sitemap: ${sitemapUrl}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
