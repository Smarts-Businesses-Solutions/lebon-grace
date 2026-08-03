import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Version-skew protection — see ops/selfhost/scripts/gen-app-container.py
  deploymentId: process.env.DEPLOYMENT_ID,
  output: "standalone",

  // Proxy the Umami tracker through this domain.
  //
  // Umami listens on loopback and on the internal docker network only, so it has
  // no public hostname and never needs one. The browser asks this site for
  // /stats/script.js and /stats/api/send, and Next forwards both to the umami
  // container over sh-apps.
  //
  // Serving analytics first-party also means content blockers, which reject
  // requests to anything that looks like an analytics domain, do not silently
  // drop the traffic and leave the dashboard reading zero.
  async rewrites() {
    return [
      {
        source: "/stats/:path*",
        destination: "http://sh-umami-umami-1:3000/:path*",
      },
    ];
  },
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

  // automaticVercelMonitors was set here. It instruments Vercel Cron Jobs, and
  // this app has not run on Vercel since it moved to self-hosting: the schedule
  // is supercronic inside a container, and errors report to GlitchTip rather
  // than Sentry's cloud. Nothing was being monitored.
});
