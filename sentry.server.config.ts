import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  /*
   * Answer "did that event actually reach GlitchTip?" without GlitchTip access.
   *
   * B-31 ended with one link still inferred rather than observed: the app is
   * proven to emit an envelope, and GlitchTip is proven to accept envelopes from
   * this container, but the hop between them — production app to real ingest —
   * was never watched. Reading a dashboard is not a check you can automate, and
   * the GlitchTip API token available here returns 401.
   *
   * With `SENTRY_DEBUG=1` the SDK logs what it sends and what came back, on
   * stdout, where `docker logs` can read it. Flip it on, provoke one error,
   * read the result, flip it off:
   *
   *   docker compose up -d --force-recreate --no-deps lebon-grace   # with the var
   *   curl -X POST https://shop.lebon-grace.com/api/stripe-webhook -d '{}'
   *   docker logs --since 2m <container> | grep -i sentry
   *
   * An env var, not a build flag: non-`NEXT_PUBLIC_` variables are read at
   * runtime, so this costs a container recreate rather than a rebuild.
   *
   * Exactly `"1"`, so a half-set `SENTRY_DEBUG=false` cannot switch it on, and
   * so the runbook has one spelling to remember.
   *
   * Safe against a feedback loop: the SDK's own logger writes through
   * `consoleSandbox`, which unwraps the patched console first, so
   * `captureConsoleIntegration` below does not turn debug output into fresh
   * events. Checked in @sentry/core rather than assumed.
   */
  debug: process.env.SENTRY_DEBUG === "1",

  /*
   * `debug` alone does not answer the question.
   *
   * It proves the SDK started — "SDK successfully initialized", "Integration
   * installed: CaptureConsole" — which is exactly the B-31 failure and worth
   * having. But it logs nothing per event, so it cannot tell you whether a
   * PARTICULAR error was accepted by GlitchTip. Checked by running it, not by
   * reading the docs.
   *
   * So the transport is wrapped to report the ingest's own status code. That
   * closes the last inferred link in B-31: app → real GlitchTip, observed from
   * inside the container with nothing but `docker logs`.
   *
   * `console.log`, not `console.error`: captureConsoleIntegration above is
   * scoped to `error`, so this cannot capture itself into a loop.
   */
  transport: (options: Parameters<typeof Sentry.makeNodeTransport>[0]) => {
    const inner = Sentry.makeNodeTransport(options);
    if (process.env.SENTRY_DEBUG !== "1") return inner;
    return {
      async send(envelope: Parameters<ReturnType<typeof Sentry.makeNodeTransport>["send"]>[0]) {
        try {
          const result = await inner.send(envelope);
          console.log(`[sentry-transport] accepted, status=${result?.statusCode ?? "none"}`);
          return result;
        } catch (error) {
          // Reported, not swallowed and not rethrown differently: a transport
          // that fails silently is the whole family of bug this exists to catch.
          console.log(`[sentry-transport] SEND FAILED: ${error instanceof Error ? error.message : error}`);
          throw error;
        }
      },
      flush: (timeout?: number) => inner.flush(timeout),
    };
  },

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
