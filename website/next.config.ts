import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const websiteRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: websiteRoot,
  },
};

export default nextConfig;
