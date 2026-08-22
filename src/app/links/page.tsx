import type { Metadata } from "next";
import Link from "next/link";
import WhatsAppLink from "@/components/WhatsAppLink";

/**
 * /links — the one URL that goes in a social profile.
 *
 * X allows exactly one clickable link on a profile, and TikTok and Instagram
 * are the same. This is the page that link points at, so a bio can offer four
 * things instead of one.
 *
 * FIRST PARTY, DELIBERATELY. The obvious alternative is Linktree. It would put
 * a third party between the shop and its customers, and it would take the click
 * data with it: X wraps every outbound link in t.co and the referrer arrives
 * blank, so the tags below are the only record of which button anyone pressed.
 * Renting that from someone else, for a page that is four links on a domain we
 * already own, is a bad trade.
 *
 * NO CHROME. StorefrontChrome hides the header and footer here. A bio landing
 * page carrying the full shop navigation is just the shop with extra steps: the
 * point is a short, obvious list of four things, on a phone, in one screen.
 *
 * NOT INDEXED. It is a doorway: no content of its own, every destination
 * already indexed on its own page. Search engines rank doorway pages poorly and
 * are right to. It stays out of sitemap.ts for the same reason.
 */

export const metadata: Metadata = {
  title: "Lebon Grace | Links",
  description:
    "Hand-made MDF puzzles, made to order in Sharjah. Shop the range, send a photo or logo to engrave, track an order, or message us.",
  alternates: { canonical: "/links" },
  robots: { index: false, follow: true },
};

/*
 * Plain hrefs with the tags inline, not /go/ redirect codes.
 *
 * The /go/ indirection exists so a URL pasted into a caption reads like a link
 * rather than a marketing funnel. Nobody ever sees an href on this page, so the
 * indirection would buy nothing and cost a redirect hop on every tap.
 *
 * WHAT THIS DOES AND DOES NOT TELL YOU. The tags are overwritten on arrival, so
 * a visit to /shop from here reports as coming from the links page, not from X.
 * The X part is already recorded: the visit to /links itself carried
 * utm_source=x from /go/xb, and Umami stitches the two pageviews into one
 * session. Two facts, joined by the session, rather than one tag trying to
 * carry both.
 */
const tag = (path: string, content: string) =>
  `${path}?utm_source=links&utm_medium=bio-page&utm_campaign=profile&utm_content=${content}`;

/*
 * Typed rather than inferred. `as const` on a heterogeneous array narrows each
 * member to its own literal shape, so `primary` exists on the first element and
 * on no other, and reading it fails to compile.
 */
interface Destination {
  href: string;
  label: string;
  note: string;
  /** Exactly one, the thing most people came for. */
  primary?: boolean;
}

const DESTINATIONS: readonly Destination[] = [
  {
    href: tag("/shop", "shop"),
    label: "Shop all puzzles",
    note: "Alphabet, numbers, animals and more",
    primary: true,
  },
  {
    href: tag("/custom", "custom"),
    label: "Photo or logo engraving",
    note: "Send artwork, we agree the design first",
  },
  {
    href: tag("/track", "track"),
    label: "Track your order",
    note: "See where your piece has got to",
  },
];

export default function LinksPage() {
  return (
    <main className="min-h-screen bg-paper px-5 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-sm">
        <header className="text-center">
          {/*
            * The mark is drawn here rather than loaded as an image. It is a
            * rounded rectangle and two letters; a network request for that
            * would be slower than the markup, and this page is opened on a
            * phone over mobile data more than anything else on the site.
            */}
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-ink font-heading text-xl text-sand"
            aria-hidden="true"
          >
            LG
          </div>

          <h1 className="mt-4 font-heading text-2xl text-ink">Lebon Grace</h1>

          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
            Hand-made MDF puzzles, cut and finished by hand in Sharjah.
            AED 15, made to order.
          </p>
        </header>

        <nav aria-label="Where to go next" className="mt-9 flex flex-col gap-3">
          {DESTINATIONS.map((d) => (
            <Link
              key={d.label}
              href={d.href}
              className={`flex min-h-14 items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                d.primary
                  ? "bg-ink text-bone hover:bg-ink-soft"
                  : "border border-ink bg-bone text-ink hover:bg-paper-deep"
              }`}
            >
              <span className="flex-1">
                <span className="block text-[0.95rem] font-medium">{d.label}</span>
                <span
                  className={`mt-0.5 block text-xs ${d.primary ? "text-sand" : "text-ink-muted"}`}
                >
                  {d.note}
                </span>
              </span>
              <span aria-hidden="true" className={d.primary ? "text-sand" : "text-sand-dark"}>
                &rarr;
              </span>
            </Link>
          ))}

          {/*
            * WhatsAppLink, not a wa.me href. The number is not in this page's
            * markup or in the JS bundle; it is fetched from
            * /api/contact/reveal on click. A bio landing page is exactly the
            * sort of URL that gets scraped, so putting the number in it would
            * undo the reveal design everywhere else on the site.
            */}
          <WhatsAppLink
            message="Hello, I found you through your profile link."
            className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-ink bg-bone px-4 py-3 text-left text-ink transition-colors hover:bg-paper-deep"
          >
            <span className="flex-1">
              <span className="block text-[0.95rem] font-medium">Message us on WhatsApp</span>
              <span className="mt-0.5 block text-xs text-ink-muted">
                Questions, sizes, bulk orders
              </span>
            </span>
            <span aria-hidden="true" className="text-sand-dark">
              &rarr;
            </span>
          </WhatsAppLink>
        </nav>

        <p className="mt-8 text-center text-xs leading-relaxed text-ink-muted">
          Name engraved free. Ready in 2-3 days.
        </p>
      </div>
    </main>
  );
}
