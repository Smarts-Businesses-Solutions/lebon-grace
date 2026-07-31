import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Version-skew protection — see ops/selfhost/scripts/gen-app-container.py
  deploymentId: process.env.DEPLOYMENT_ID,
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cbu01.alicdn.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // No SENTRY_AUTH_TOKEN in container builds — release creation calls
  // `sentry-cli releases new` and fails the build. Errors still report at runtime.
  release: { create: false, finalize: false },
  // Only enable source map upload when auth token is available
  silent: !process.env.SENTRY_AUTH_TOKEN,
  org: "smarts-businesses-solutions",
  project: "lebon-grace",

  // Source map config
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  disableLogger: true,

  // Vercel integration
  automaticVercelMonitors: true,
});
