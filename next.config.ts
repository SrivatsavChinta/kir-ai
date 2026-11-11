import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@modelcontextprotocol/server"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
