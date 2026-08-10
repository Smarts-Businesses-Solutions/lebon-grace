/**
 * What delivery costs — the single source of truth, usable on both sides.
 *
 * These constants and this rule lived only in `cart-context.tsx`, a client
 * module. `/api/checkout` therefore had nothing to check against and simply
 * charged whatever `shipping` arrived in the request body, so `{"shipping": 0}`
 * bought free delivery (SH-03). Item prices were already re-read from the
 * catalog; the delivery fee was the one money value still taken on trust.
 *
 * Deliberately its own module rather than an import from `cart-context`: that
 * file is a client component with React state, and a server route importing it
 * would drag the provider along. A plain rule belongs where both can reach it.
 */

/** Flat UAE delivery fee, in AED. */
export const UAE_DELIVERY = 20;

/** Order value at or above which delivery is free, in AED. */
export const FREE_DELIVERY_OVER = 150;

/** How the customer receives the order. `pickup` is collection from the workshop. */
export type DeliveryMethod = "pickup" | "delivery";

/**
 * The fee for a given order value and method.
 *
 * `subtotal` must be the SERVER's subtotal — the one recomputed from catalog
 * prices — or this simply launders a client-supplied number through a
 * trustworthy-looking function.
 *
 * Anything that is not exactly `"pickup"` is treated as delivery: an unknown or
 * missing method should cost the customer nothing extra, but it must not make
 * delivery free.
 */
export function deliveryFeeFor(subtotal: number, method: string | undefined): number {
  if (method === "pickup") return 0;
  return subtotal >= FREE_DELIVERY_OVER ? 0 : UAE_DELIVERY;
}
