import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Version-skew protection — see ops/selfhost/scripts/gen-app-container.py
  deploymentId: process.env.DEPLOYMENT_ID,
  output: "standalone",


  /**
   * Baseline browser security headers (SH-05).
   *
   * Production served none of these. They cost nothing, break nothing, and each
   * removes a real class of attack on a shop that redirects to a card form and
   * keeps customer addresses behind an admin login.
   *
   * **On the CSP.** `script-src` deliberately allows `'unsafe-inline'`. The
   * strict alternative is a per-request nonce, which Next generates in the
   * proxy — and reading a nonce forces **dynamic rendering** on every page that
   * does. This shop is almost entirely prerendered (the live homepage returns
   * `X-Nextjs-Prerender: 1` from cache), so a nonce policy would trade the thing
   * that makes it fast for a directive guarding against an injection vector we
   * do not have: there is no user-authored HTML anywhere on the storefront.
   *
   * The directives that need no nonce are enforced strictly, and they are not
   * decoration — `frame-ancestors` is what stops `/admin` being clickjacked,
   * `base-uri` stops a single injected `<base>` rewriting every relative URL on
   * the page, and `form-action` stops a form posting the cart somewhere else.
   *
   * Revisit if the storefront ever renders customer-supplied HTML, at which
   * point the nonce is worth the caching.
   */
  async headers() {
    const csp = [
      "default-src 'self'",
      // See the note above: nonce-free by choice, not by oversight.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // Next creates web workers from blob: URLs. Without this the browser
      // refuses them and the console fills with violations — which the smoke
      // suite correctly reports as "renders with defects". Found by running the
      // full suite, not by reading the policy.
      "worker-src 'self' blob:",
      // Catalogue images come from these two hosts (see remotePatterns below);
      // data: and blob: are used by next/image placeholders.
      "img-src 'self' data: blob: https://cbu01.alicdn.com https://*.supabase.co",
      "font-src 'self' data:",
      // Error reporting must still reach GlitchTip, or this header silently
      // switches off the monitoring B-31 was spent restoring.
      "connect-src 'self' https://glitchtip.axiomsynapse.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Stops a browser second-guessing Content-Type — the root of "upload
          // a .png that is really a script".
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Order-tracking URLs carry an order id. Without this, that id leaks
          // in the Referer to every third-party host a page touches.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Belt and braces with frame-ancestors, for anything that predates CSP.
          { key: "X-Frame-Options", value: "DENY" },
          // The shop needs none of these; granting nothing is the honest default.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },

  /**
   * Short campaign links: /go/:channel -> the homepage, UTM-tagged.
   *
   * Umami has a UTM report and a referrer report, but the referrer is useless
   * for exactly the traffic the launch is aiming at. Links opened inside the
   * TikTok, Instagram and Facebook in-app browsers arrive with no Referer or a
   * generic app one, and this site sends `strict-origin-when-cross-origin`
   * anyway. UTM parameters travel in the URL, so they survive all of that.
   *
   * The indirection exists so the captions stay clean. Pasting
   * `?utm_source=tiktok&utm_medium=social&utm_campaign=launch-2026` into a post
   * reads like a marketing funnel, which is the opposite of how these films are
   * written. `shop.lebon-grace.com/go/tt` reads like a link.
   *
   * TEMPORARY, NOT PERMANENT. A 308 is cached by the browser indefinitely, so a
   * later campaign could never reuse `/go/yt` for anyone who clicked the first
   * one. These must stay 307.
   *
   * `/go/` is a namespace, not a bare path, so a channel code can never collide
   * with a future product slug.
   */
  async redirects() {
    const CAMPAIGN = "launch-2026";

    /*
     * channel code -> [utm_source, utm_content, utm_campaign?]
     *
     * utm_content separates two placements on the same platform; the main
     * YouTube upload and the Short are different posts of different films.
     *
     * The third slot overrides the campaign, and exists for one real
     * distinction: a POST belongs to the campaign that produced it, but a
     * PROFILE LINK outlives every campaign. It sits in a bio until someone
     * edits it. Tagging that `launch-2026` means that a year from now, profile
     * traffic still reports as launch traffic and the number is quietly wrong.
     */
    const CHANNELS: Record<string, [string, string] | [string, string, string]> = {
      yt: ["youtube", "main-upload"],
      yts: ["youtube", "shorts"],
      li: ["linkedin", "post"],
      x: ["x", "post"],
      /*
       * The X profile bio. Separate from `x` on purpose: X wraps every link in
       * t.co and the referrer arrives BLANK, so the UTM tags are not a nicety
       * here, they are the only thing that makes the click attributable at all.
       * Sharing `x` between a post and the bio would merge the two placements
       * that utm_content exists to keep apart.
       *
       * Left as its own code rather than retagging `tt` and `ig`, which are
       * also bio links still carrying the launch campaign. Those have clicks
       * behind them already, and changing a live link's campaign splits its
       * history across two names. Worth fixing deliberately, not in passing.
       */
      xb: ["x", "bio", "profile"],
      tt: ["tiktok", "bio"],
      ig: ["instagram", "bio"],
      fb: ["facebook", "post"],
    };

    return Object.entries(CHANNELS).map(([code, [source, content, campaign]]) => ({
      source: `/go/${code}`,
      destination:
        `/?utm_source=${source}&utm_medium=social` +
        `&utm_campaign=${campaign ?? CAMPAIGN}&utm_content=${content}`,
      permanent: false,
    }));
  },

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
        destination: `${process.env.UMAMI_ORIGIN || 'http://sh-umami-umami-1:3000'}/:path*`,
      },
    ];
  },
  images: {
    // Cap the srcset ladder at the real ceiling of our own photography.
    //
    // Chromium selects the LARGEST srcset candidate for `loading="lazy"`
    // images that are still offscreen, ignoring `sizes` entirely — a
    // long-standing browser behaviour, not a markup fault. On the homepage
    // that made all eight cards in the second product grid request w=3840
    // (98 KB each) for a 384px box that needs w=640 (42 KB each), and the
    // eight cold transforms were slow enough to leave visible empty cards
    // on a first visit.
    //
    // We cannot change the browser's choice, so we bound what it can choose.
    // The widest source photo in public/images/lasercut is 1600px (123 files,
    // median 1254), so every rung above that returned the same pixels in a
    // bigger file — Next never upscales past the source. Removing 1920/2048/
    // 3840 costs no visible quality at any viewport and makes the worst case
    // the same image the layout actually wanted.
    //
    // If genuinely larger artwork is ever added, raise this to match it.
    deviceSizes: [640, 750, 828, 1080, 1200, 1600],
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
