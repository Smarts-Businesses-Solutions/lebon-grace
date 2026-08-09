import Stripe from "stripe";

/**
 * The single Stripe client.
 *
 * There were two, each constructed inline in a route, neither pinning an API
 * version. That is three separate ways for the payment path to drift.
 *
 * ── API version ──────────────────────────────────────────────────────────────
 * Stripe's API is date-versioned and an unpinned client follows whatever default
 * the ACCOUNT is set to, which someone can change in the Dashboard without
 * touching this repo. The payment path then changes behaviour with no commit
 * and no deploy. Pinning here means the version is reviewable, and upgrading is
 * a deliberate act with the changelog open.
 *
 * The value matches what stripe-node 22.3.0 itself targets, so SDK types and
 * wire format agree. Stripe announces breaking changes at least three months
 * ahead; bump this and the SDK together.
 */
export const STRIPE_API_VERSION = "2026-06-24.dahlia" as const;

/** "live" | "test", read from the secret key itself rather than a separate flag. */
export type StripeMode = "live" | "test" | "unknown";

export function stripeMode(key = process.env.STRIPE_SECRET_KEY || ""): StripeMode {
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  return "unknown";
}

export function isLive(): boolean {
  return stripeMode() === "live";
}

let _client: Stripe | null = null;

export function stripe(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    // Loud and specific. A missing key used to surface as a generic 500 from
    // whichever route happened to be hit first.
    throw new Error(
      "[stripe] STRIPE_SECRET_KEY is not set. Checkout and the webhook cannot work without it."
    );
  }
  _client = new Stripe(key, { apiVersion: STRIPE_API_VERSION, typescript: true });
  return _client;
}

/**
 * Configuration problems that make the shop take money without recording orders.
 *
 * The failure this exists to catch is the commonest launch bug there is: live
 * secret key deployed alongside the TEST webhook signing secret. Payments
 * succeed, the customer is charged, every webhook fails signature verification,
 * and no order is ever created. Nothing in the app looks broken.
 *
 * A signing secret carries no mode marker (both are `whsec_...`), so a mismatch
 * cannot be detected by inspecting the strings. What CAN be checked is that the
 * pieces are present and internally consistent, and the rest is covered by
 * scripts/stripe/preflight.mjs, which asks Stripe itself.
 */
export function stripeConfigProblems(): string[] {
  const problems: string[] = [];
  const key = process.env.STRIPE_SECRET_KEY || "";
  const whsec = process.env.STRIPE_WEBHOOK_SECRET || "";
  const mode = stripeMode(key);

  if (!key) problems.push("STRIPE_SECRET_KEY is not set.");
  else if (mode === "unknown") {
    problems.push(
      "STRIPE_SECRET_KEY does not look like a Stripe secret key (expected sk_live_/sk_test_)."
    );
  }

  if (!whsec) {
    problems.push(
      "STRIPE_WEBHOOK_SECRET is not set, so every webhook will be rejected and no order will be recorded."
    );
  } else if (!whsec.startsWith("whsec_")) {
    problems.push("STRIPE_WEBHOOK_SECRET does not start with whsec_.");
  }

  if (mode === "test" && process.env.NODE_ENV === "production") {
    problems.push(
      "Running in production against Stripe TEST keys: no real payment can be taken."
    );
  }

  return problems;
}
