import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  /*
   * console.error must actually REACH GlitchTip.
   *
   * It did not. `captureConsoleIntegration` is opt-in and was never configured,
   * so a console.error was only a BREADCRUMB — carried along with some later
   * event, never an event itself. The code believed otherwise:
   * stripe-webhook/route.ts says "console.error so it reaches GlitchTip, not
   * console.log". It did not. So B-18 — a paid order with NO LINE ITEMS, which
   * the workshop cannot make — reported to nobody at all.
   *
   * Scoped to "error" deliberately: capturing warn and log as well would turn
   * every routine warning into an issue, and a channel that is mostly noise is
   * one nobody reads.
   */
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],

  /*
   * --- Quota (free plan: 5,000 errors/month SHARED across all projects) ---
   *
   * Was 0.25, "only send 25% of errors". That is a busy-service setting, and
   * this shop has had one order in its life: it was discarding three of every
   * four real errors to protect a quota that near-zero traffic was never going
   * to threaten. Worse, it compounded the problem above — the few events that
   * did exist were then sampled away.
   *
   * At 1.0 every server error is sent. The noise filters below are what keeps
   * that affordable, and they matter more now that console capture is on. If
   * this ever does threaten the shared quota, lower THIS number rather than
   * turning console capture back off — losing 75% of a signal is worse than
   * losing all of a duplicate.
   */
  sampleRate: 1.0,
  tracesSampleRate: 0.05, // 5% of transactions — volume control, not error loss

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
    /*
     * Read the MESSAGE as well as the exception.
     *
     * These filters inspected `event.exception` only. A console-captured event
     * is a MESSAGE, not an exception, so with the integration above every one
     * of them would sail straight past — starting with the webhook signature
     * failure, which any bot POSTing to /api/stripe-webhook provokes. The
     * filter has to see both shapes, or switching console capture on floods the
     * very channel it was switched on to fix.
     */
    const message = event.exception?.values?.[0]?.value || event.message || "";

    /*
     * Stripe webhook signature noise. Bots probe that endpoint constantly and a
     * bad signature from a stranger is not an incident.
     *
     * This does NOT hide a real misconfiguration: the app logs its own, quite
     * differently worded diagnostic for that case ("[stripe-webhook] SIGNATURE
     * VERIFICATION FAILED. mode=… If payments are succeeding but no orders
     * appear, the signing secret does not match…"), which now reaches GlitchTip
     * through console capture. Generic noise out, our own diagnosis in.
     */
    if (message.includes("Webhook signature verification failed")) {
      return null;
    }

    // Drop Supabase connection pool exhaustion (transient, handled by retry)
    if (message.includes("supabase") && message.includes("connection")) {
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
