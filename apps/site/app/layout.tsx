import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { description } from "@/content/site";
import { getSiteUrl } from "@/lib/metadata";
import { DeferredTelemetry } from "@/components/layout/DeferredTelemetry";
import "./globals.css";


const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Lumenva | Atendimento e vendas com IA",
    template: "%s | Lumenva",
  },
  description,
  icons: {
    icon: "/icon",
    apple: "/brand/apple-touch-icon.png",
  },
  openGraph: {
    locale: "pt_PT",
  },
};

export const viewport: Viewport = {
  themeColor: "#F5F5F7",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-PT" className={manrope.variable}>
      <body>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
        <DeferredTelemetry />
      </body>
    </html>
  );
}
