import Script from "next/script";

/**
 * Umami analytics, served first-party.
 *
 * Replaces PostHogProvider. PostHog was running 22 containers and 6.93 GiB on
 * the host to collect, for this site, page views and nothing else: an audit on
 * 3 Aug 2026 found zero posthog.capture calls, zero identify, zero feature
 * flags and zero surveys anywhere in this codebase. Umami does the same job in
 * two containers and about 280 MiB.
 *
 * The tracker is proxied through THIS domain via a rewrite in next.config.ts
 * rather than loaded from an analytics hostname. Three reasons, in order of
 * how much they matter:
 *
 *   1. No public hostname is needed for Umami at all. It listens on loopback
 *      and is reached over the internal docker network, so it is never exposed.
 *   2. First-party requests are not blocked by the content blockers that
 *      reject anything matching an analytics domain, so the numbers are real.
 *   3. It is cookieless, which matters here: the privacy policy claims
 *      analytics cookies while no consent banner exists on the site.
 *
 * NEXT_PUBLIC_UMAMI_WEBSITE_ID is inlined at build time. That is fine: a
 * website ID is not a secret, it appears in the page source of every site
 * using Umami by design.
 */
const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

export default function Analytics() {
  // No ID configured means analytics are simply off, which is what should
  // happen in local development rather than posting junk into production data.
  if (!WEBSITE_ID) return null;

  return (
    <Script
      src="/stats/script.js"
      data-website-id={WEBSITE_ID}
      // Send events to the same proxied path rather than the script's origin.
      data-host-url="/stats"
      strategy="afterInteractive"
    />
  );
}
