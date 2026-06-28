import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  // Edge middleware runs on every request — keep sampling very low
  sampleRate: 0.25,
  tracesSampleRate: 0.02, // 2% of edge transactions (high volume, low value)

  environment: process.env.NODE_ENV,

  ignoreErrors: [
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
  ],
});
