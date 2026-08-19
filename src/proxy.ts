import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-auth";

/**
 * Deny-by-default for `/api/*`.
 *
 * WHY THIS EXISTS. There was no middleware at all, so **a new file under
 * `src/app/api/` was public the moment it was created**. That is not a
 * hypothetical: `/api/variants?pid=` shipped as an unauthenticated, unthrottled
 * proxy onto a metered third-party API on our own key (B-25), and it was
 * written up in FOR-EVARISTE *and* ACTORS.md as the worked example of this
 * exact hazard while staying open for months. Documenting a hazard does not
 * remove it; a default does.
 *
 * WHAT IT DOES, AND DELIBERATELY DOES NOT DO.
 *
 * It answers one question: **is this route one we meant to publish?** A path
 * under `/api/` that is not listed below is answered **404**, so an API route
 * added without a decision about its exposure is unreachable rather than open.
 *
 * It does **not** authenticate. Route handlers keep their own `requireAdmin()`,
 * which verifies the signed session properly. Duplicating that here would create
 * two authorities that can disagree, and the one in front is the one nobody
 * remembers to update. The cookie check below is presence-only and is defence in
 * depth, not the gate.
 *
 * WHY AN EXPLICIT LIST RATHER THAN A PREFIX RULE. The obvious implementation —
 * "anything under `/api/admin/` needs a session" — locks everybody out of the
 * shop forever, because `/api/admin/login` is how you *get* a session. Prefixes
 * cannot express that; a list can. This is also why every entry is an exact
 * path: there are no dynamic segments anywhere under `/api/`, so exact matching
 * is both safe and unambiguous.
 *
 * ADDING A ROUTE. Add it to one of the two lists in the same change. If you
 * forget, it 404s in development and the console tells you why — which is the
 * point: the failure is loud, local, and before anyone else can reach it.
 */

/**
 * Reachable without a session, by design.
 *
 * Each of these is public for a reason, and the reason is worth keeping next to
 * the entry, because "why is this one open?" is exactly the question a reviewer
 * should be able to answer without reading the handler.
 */
const PUBLIC_API = new Set([
  // Build provenance. Returns { sha, service, timestamp } and nothing else, so a
  // deploy checker or the monitor can ask which commit is live WITHOUT shell
  // access to cx53. Left unregistered it 404s here, which is how the 2026-08-16
  // provenance deploy ended up verifiable only via `docker inspect`. A commit sha
  // grants nothing: the repo is private and the value is already in the image
  // label anyone with the host can read.
  "/api/health/version",

  // The way IN. Must be anonymous or nobody can ever authenticate.
  "/api/admin/login",

  // Customer-facing, all rate-limited in their handlers.
  "/api/checkout", //               creates a Stripe session
  "/api/contact", //                enquiry form
  "/api/contact/reveal", //         phone/WhatsApp, kept out of page source
  "/api/custom", //                 custom design request, artwork before any order
  "/api/newsletter", //             subscribe
  "/api/newsletter/unsubscribe", // the privacy policy promises this works
  "/api/newsletter/confirm", //      the double opt-in link, opened from an inbox (NS-01)
  "/api/cart-recovery", //          browser-triggered "you left items behind"
  "/api/reviews", //                GET is public; POST is gated on a delivered order

  // Mixed: a guest branch AND an admin branch in one handler, which gates
  // itself. `/api/orders` serves track (order id + phone) and account
  // (email + phone); its unfiltered listing is behind requireAdmin.
  // `/api/products` is admin-only on EVERY verb since 2026-08-13 — its rows
  // carry supplier ids and cost prices. It stays listed here because the path
  // must reach the handler that does the gating.
  "/api/orders",
  "/api/products",

  // Stripe calls this. It authenticates by SIGNATURE, not by session — a
  // cookie check here would break payments outright.
  "/api/stripe-webhook",

  // Local variant lookup for the product page. The CJ passthrough that made
  // this dangerous is gone (B-25); what remains is a database read.
  "/api/variants",
]);

/**
 * Exist, but are for the operator.
 *
 * The handler still does the real check. This list means a route added here
 * without a `requireAdmin()` is not anonymously reachable anyway.
 */
const ADMIN_API = new Set([
  "/api/admin/subscribers", // a list of people's email addresses
  "/api/metrics", //           order counts and revenue
  "/api/admin/design-requests", //         names, emails, phones, and pointers to
  //                                       photographs customers sent, often of children
  "/api/admin/design-requests/artwork", // mints a 60s signed URL to one photograph
]);

export function proxy(request: NextRequest) {
  // Trailing slashes normalised so "/api/metrics/" cannot slip past a Set
  // lookup that only knows "/api/metrics".
  const path = request.nextUrl.pathname.replace(/\/+$/, "") || "/";

  if (PUBLIC_API.has(path)) return NextResponse.next();

  if (ADMIN_API.has(path)) {
    // Presence only. `requireAdmin()` in the handler verifies the signature and
    // the expiry — this just means an anonymous caller never reaches it.
    if (!request.cookies.get(ADMIN_COOKIE)?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Unregistered. 404 rather than 401: a caller should not learn that a path
  // exists by the shape of its refusal.
  console.warn(
    `[proxy] blocked unregistered API route: ${request.method} ${path}. ` +
      `If this is a real route, add it to PUBLIC_API or ADMIN_API in src/proxy.ts.`
  );
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export const config = {
  // Only /api/*. Pages are untouched, so a mistake here cannot take the shop
  // down — the worst case is an API route answering 404 until it is listed.
  matcher: "/api/:path*",
};
