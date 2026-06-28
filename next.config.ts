import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
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
