/**
 * Next's instrumentation hook — where Sentry is initialised for the server.
 *
 * ## This file MUST live in `src/`, not the repo root
 *
 * It sat at the repo root for the whole life of this project, and **Next never
 * called `register()` once**. Not in standalone, not under `next start`, not
 * with Turbopack, not with webpack. Server-side error reporting had therefore
 * never run: every server `console.error` and every unhandled server exception
 * went nowhere, while GlitchTip stayed populated by the browser bundle and the
 * uptime shell script — which is precisely why nobody noticed.
 *
 * This app keeps its code in `src/app`, and when `src/` is used the
 * instrumentation hook has to be `src/instrumentation.ts`. A root-level file is
 * silently ignored: no warning at build, no warning at boot, no error at
 * runtime. The same rule as `src/app` vs `app` — the one Next documents as
 * "`src/app` will be ignored if `app` is present in the root".
 *
 * Do not be reassured by `getPossibleInstrumentationHookFilenames` listing both
 * the root and `src/`. That enumerates *candidates*; it is not the resolution
 * rule, and reading it as one cost this project a wrong root-cause and a
 * production outage (B-31).
 *
 * The sentry configs stay at the repo root because `withSentryConfig` and the
 * Sentry CLI expect them there — hence the `../` imports.
 *
 * **Verify by behaviour, never by inspection.** Whether this file is loaded is
 * invisible from the outside: a hook that never runs and a hook that runs
 * cleanly look identical. `scripts/prove-sentry-init.mjs` answers it by
 * counting envelopes that actually reach an ingest.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
