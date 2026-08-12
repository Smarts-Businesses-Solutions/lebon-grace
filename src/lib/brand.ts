/**
 * The marker that says a Stripe session belongs to this shop.
 *
 * This Stripe account serves more than one business. On 2026-08-12 it had two
 * LIVE webhook endpoints subscribed to `checkout.session.completed` — this shop
 * and `sell-fast-partout` — and Stripe fans that event out to every subscribed
 * endpoint, signing each delivery with that endpoint's own secret.
 *
 * So a valid signature proves only that Stripe sent the event. It never proves
 * the sale was ours. `/api/checkout` stamps this on every session it creates and
 * `/api/stripe-webhook` refuses anything without it.
 *
 * It lives here rather than as a literal in both files because the two must
 * agree exactly. If they drifted apart, the webhook would reject every genuine
 * order — silently, since ignoring a foreign session is normal and logged as
 * routine. Payments would keep succeeding while no order was ever created.
 */
export const BRAND = "lebon-grace";
