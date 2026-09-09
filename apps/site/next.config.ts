import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import withBundleAnalyzer from "@next/bundle-analyzer";

// The workspace root must include the root node_modules/next symlink after the
// former website/ app moved under apps/site.
const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

const isDevelopment = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  // TODO: migrar para nonce-based CSP
  `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "report-to csp-endpoint",
  "report-uri /api/csp-report",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Reporting-Endpoints", value: 'csp-endpoint="/api/csp-report"' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { formats: ["image/avif", "image/webp"] },
  turbopack: {
    root: workspaceRoot,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/precos",
        destination: "/produto",
        permanent: true,
      },
    ];
  },
};

const withAnalyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" });
export default withAnalyzer(nextConfig);
