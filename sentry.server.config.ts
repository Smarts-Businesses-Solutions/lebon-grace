import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  // --- Quota protection (free plan: 5,000 errors/month shared across all projects) ---
  sampleRate: 0.25, // Only send 25% of errors
  tracesSampleRate: 0.05, // 5% of transactions

  environment: process.env.NODE_ENV,

  // Drop noisy server-side errors before they consume quota
  ignoreErrors: [
    // Supabase auth (expected flow — expired sessions, missing tokens)
    "AuthSessionMissingError",
    "AuthApiError",
    "Invalid Refresh Token",
    "JWT expired",

    // Network timeouts to external services (transient, not actionable)
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_SOCKET_TIMEOUT",

    // Next.js internal (not our bugs)
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",

    // Stripe webhook noise
    "Webhook signature verification failed",
  ],

  beforeSend(event) {
    const message = event.exception?.values?.[0]?.value ?? "";

    // Drop Stripe webhook signature errors (usually replays/test events)
    if (message.includes("Webhook signature verification failed")) {
      return null;
    }

    // Drop Supabase connection pool exhaustion (transient, handled by retry)
    if (message.includes("supabase") && message.includes("connection")) {
      return null;
    }

    // Drop CJ Dropshipping API timeouts (external service, not our bug)
    if (message.includes("CJ") && (message.includes("timeout") || message.includes("ETIMEDOUT"))) {
      return null;
    }

    // Strip PII from breadcrumbs
    event.breadcrumbs = event.breadcrumbs?.map((b) => {
      if (b.message) {
        b.message = b.message.replace(/[\w.-]+@[\w.-]+\.\w+/g, "[email]");
        b.message = b.message.replace(/\+971\s?\d{2}\s?\d{3}\s?\d{4}/g, "[phone]");
      }
      return b;
    });

    return event;
  },
});
