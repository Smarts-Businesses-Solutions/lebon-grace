import type { MetadataRoute } from "next";

/**
 * What a phone needs in order to install the shop to a home screen.
 *
 * INSTALLABLE, NOT OFFLINE. There is deliberately no service worker anywhere in
 * this project, and this file does not imply one. On a shop taking live card
 * payments, a cache sitting between the customer and the server is a way to
 * show a price we are not honouring, or to intercept the return leg of a Stripe
 * redirect. Everything here is presentation: an icon, a colour, a window
 * without browser chrome. Nothing about the money path changes.
 *
 * NOT force-dynamic, unlike sitemap.ts and robots.ts. Those read the runtime
 * app URL, so Next freezing them at build time baked in a placeholder host and
 * served it to crawlers for weeks. This file has no runtime input at all -- the
 * URLs are relative and the colours are literals -- so prerendering it is
 * correct rather than a trap.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // A stable id, so a later change to start_url is treated by the browser as
    // the same app rather than a second one appearing beside it.
    id: "/",

    name: "Lebon Grace",
    // 12 characters is roughly what an Android launcher shows before it
    // truncates, so this is the full name rather than a shortened one.
    short_name: "Lebon Grace",
    description:
      "Puzzles for children, cut and finished by hand in our UAE workshop. Made to order, with a name engraved free.",

    /*
     * Tagged, because an installed app produces no referrer and no campaign
     * link. Without this, every visit from a home screen icon lands in Umami
     * as direct traffic and there is no way to tell whether anyone installed
     * it at all.
     */
    start_url: "/?utm_source=pwa&utm_medium=homescreen",
    scope: "/",

    display: "standalone",
    orientation: "portrait",
    lang: "en-AE",
    dir: "ltr",
    categories: ["shopping", "lifestyle"],

    // --color-bone: the splash screen behind the icon while the app opens, so
    // it should be the page background rather than the icon background.
    background_color: "#fdfbf7",
    // --color-ink: the status bar and title bar of the standalone window.
    theme_color: "#23201c",

    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      /*
       * Separate file, not the same one listed twice.
       *
       * A launcher masks a maskable icon to its own shape and keeps only the
       * middle 80%. Reusing an icon that draws its own rounded corners gets
       * those corners sliced off and the letters clipped; the maskable one is
       * full bleed with the mark small and centred.
       */
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],

    /*
     * Long-press shortcuts. Chosen as the three things someone opens the app to
     * do, not as a copy of the navigation: browse, chase an order they have
     * already placed, or start a photo piece.
     */
    shortcuts: [
      { name: "Shop", url: "/shop", description: "Every puzzle we make" },
      { name: "Track an order", url: "/track", description: "Where your piece has got to" },
      { name: "Photo or logo", url: "/custom", description: "Send artwork for a custom piece" },
    ],
  };
}
