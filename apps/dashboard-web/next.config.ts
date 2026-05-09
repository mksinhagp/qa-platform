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
};

export default nextConfig;
