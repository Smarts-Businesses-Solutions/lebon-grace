import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  // Same switch as the server config, deliberately. A debug flag that quietly
  // covers only one runtime is worse than none: you turn it on, see nothing from
  // the proxy, and conclude the proxy reported nothing.
  debug: process.env.SENTRY_DEBUG === "1",

  /*
   * `error` only, NOT `warn`.
   *
   * src/proxy.ts console.warns every blocked request, and blocked is what a bot
   * probing /api/wp-login gets — capturing warn here would turn background
   * internet noise into a stream of issues and the channel would stop being
   * read (L-5). An actual thrown error in the proxy is the opposite: it sits in
   * front of every single API route, so it is the highest-consequence failure
   * in the app.
   */
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],

  /*
   * Was 0.25, under the comment "edge middleware runs on every request — keep
   * sampling very low". That conflated two settings: `tracesSampleRate` is what
   * controls the per-request volume, while `sampleRate` governs ERRORS, which
   * are rare here and never routine. At 0.25 an exception thrown in the proxy —
   * breaking every API call the shop makes — had a 3-in-4 chance of being
   * thrown away. Volume control stays below, on the line that actually does it.
   */
  sampleRate: 1.0,
  tracesSampleRate: 0.02, // 2% of edge transactions (high volume, low value)

  environment: process.env.NODE_ENV,

  ignoreErrors: [
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
  ],
});
