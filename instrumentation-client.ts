// Client-side Sentry/GlitchTip initialisation.
//
// WHY THIS FILE EXISTS
// @sentry/nextjs v9+ no longer loads `sentry.client.config.ts` on Next 15+.
// Client init must live in `instrumentation-client.ts`, which Next loads on the
// browser side. Without it the config file is never bundled, so
// `process.env.NEXT_PUBLIC_SENTRY_DSN` is never inlined and the browser SDK
// never initialises -- silently. Nothing fails; errors simply never arrive.
//
// That was the state of this app: a sentry.client.config.ts referencing the DSN
// that Next had stopped reading, so no DSN of any kind appeared in the built
// bundle. Verified by grepping the built image, which contained no DSN at all.
//
// The existing config is IMPORTED rather than copied, so each app keeps its own
// sampleRate, tracesSampleRate and ignoreErrors rules. Sentry.init() runs as a
// side effect of that import.
import * as Sentry from '@sentry/nextjs';

import './sentry.client.config';

// Required for navigation instrumentation in the App Router. Without it Sentry
// cannot tie errors to the route transition that caused them.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
