import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mark server-only packages as external to prevent client-side bundling
  serverExternalPackages: [
    "@qa-platform/db",
    "@qa-platform/auth",
    "@qa-platform/vault",
    "@qa-platform/config",
    "argon2",
    "@mapbox/node-pre-gyp",
    "pg",
  ],

  // Turbopack configuration to exclude server-only packages from client bundle
  turbopack: {
    resolveAlias: {
      "@qa-platform/db": "node:fs",
      "@qa-platform/auth": "node:fs",
      "@qa-platform/vault": "node:fs",
      "@qa-platform/config": "node:fs",
      "argon2": "node:fs",
      "@mapbox/node-pre-gyp": "node:fs",
    },
  },
};

export default nextConfig;
