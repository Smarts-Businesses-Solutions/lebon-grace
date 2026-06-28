import * as Sentry from "@sentry/nextjs";

// Dedupe: track recent error fingerprints to avoid sending the same error repeatedly
const recentErrors = new Map<string, number>();
const DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,

  // --- Quota protection (free plan: 5,000 errors/month shared across all projects) ---
  sampleRate: 0.25, // Only send 25% of errors
  tracesSampleRate: 0.05, // 5% of transactions

  // Session replay: error-only (no replays for healthy sessions).
  // Privacy: maskAllText + blockAllMedia ensures no customer data captured.
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    }),
  ],
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  environment: process.env.NODE_ENV,

  // Drop noisy/irrelevant browser errors before they consume quota
  ignoreErrors: [
    // Network errors (user's connection, not our bug)
    "Failed to fetch",
    "Load failed",
    "NetworkError",
    "Network request failed",
    "AbortError",
    "TypeError: cancelled",
    "TypeError: Cancelled",
    "TypeError: Failed to fetch",
    "TypeError: Load failed",
    "TypeError: NetworkError",
    "net::ERR_",

    // Browser extensions / third-party scripts
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    "ResizeObserver loop",
    "ResizeObserver loop completed with undelivered notifications",

    // Next.js hydration (usually harmless, very noisy)
    "Hydration failed",
    "There was an error while hydrating",
    "Text content does not match",
    "Minified React error",

    // Next.js internal navigation
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
    "An unexpected response was received from the server",

    // Auth / session expired (expected user flow, not a bug)
    "AuthSessionMissingError",
    "AuthApiError",
    "AuthRetryableFetchError",
    "Invalid Refresh Token",
    "JWT expired",

    // Stripe.js loading issues (user ad-blockers)
    "Stripe is not defined",
    "stripe.js could not be loaded",
    "Webhook signature verification failed",

    // Chunk loading (PWA / lazy loaded routes)
    "ChunkLoadError",
    "Loading chunk",
    "Script error",
    "Object Not Found Matching",

    // Generic noise
    "Non-Error promise rejection captured",
    "Non-Error exception captured",
  ],

  // Fine-grained filtering + deduplication + PII scrubbing
  beforeSend(event) {
    // Skip errors from browser extensions
    const frames = event.exception?.values?.[0]?.stacktrace?.frames;
    if (frames?.some((f) => f.filename?.includes("extension://"))) {
      return null;
    }

    // Deduplicate: same error message within 5 min window
    const fingerprint =
      event.exception?.values?.[0]?.value?.substring(0, 120) ?? "";
    if (fingerprint) {
      const now = Date.now();
      const lastSeen = recentErrors.get(fingerprint);
      if (lastSeen && now - lastSeen < DEDUPE_WINDOW_MS) {
        return null; // Drop duplicate
      }
      recentErrors.set(fingerprint, now);

      // Cleanup old entries to prevent memory leak
      if (recentErrors.size > 100) {
        for (const [key, ts] of recentErrors) {
          if (now - ts > DEDUPE_WINDOW_MS) recentErrors.delete(key);
        }
      }
    }

    // Strip PII from breadcrumbs (customer emails, names)
    event.breadcrumbs = event.breadcrumbs?.map((b) => {
      if (b.message) {
        b.message = b.message.replace(/[\w.-]+@[\w.-]+\.\w+/g, "[email]");
      }
      return b;
    });

    // Strip user PII
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
    }

    return event;
  },
});
