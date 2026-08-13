/**
 * Checkout price integrity.
 *
 * This is the most expensive thing in the codebase to get wrong: a regression
 * here charges the wrong amount, silently, on a live Stripe account. It had no
 * test until now (ACTION_PLAN.md A-4).
 *
 * The route is exercised through its real POST handler with Stripe stubbed at
 * the module boundary, so what we assert on is the exact `line_items` payload
 * that would have gone to Stripe.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Catalogue the route validates against. Kept tiny and explicit so a test
// failure points at the rule that broke, not at a fixture that drifted.
// The route looks products up with getProductBySlug, not products.find, so that
// an UNLISTED product (the internal AED 2 test item) is still sellable — it is
// deliberately absent from `products`, which is the browsable set.
//
// Everything lives INSIDE the factory: vi.mock is hoisted above the file's
// top-level declarations, so referring to one from here is a ReferenceError.
//
// The unlisted entry is the point of the mock: findable by slug, never in
// `products`.
vi.mock("@/lib/products", () => {
  const CATALOGUE = [
    { slug: "abc-jigsaw-board", name: "ABC Jigsaw Board", price: 15, imageUrl: "/images/lasercut/abc-jigsaw-board-0.png" },
    { slug: "phone-case-clearance", name: "Phone Case Clearance", price: 5, imageUrl: "/images/clearance/phone-case-clearance-0.jpg" },
  ];
  const UNLISTED = { slug: "internal-test-item", name: "Internal Test Item", price: 2, imageUrl: "/images/products/placeholder.svg", unlisted: true };
  return {
    products: CATALOGUE,
    getProductBySlug: (slug: string) => [...CATALOGUE, UNLISTED].find((p) => p.slug === slug),
  };
});

// Rate limiting is not under test; let every request through.
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "https://shop.lebon-grace.com" }));

/** Just enough of Stripe's session params to assert on; typed so `mock.calls` is too. */
type SessionParams = {
  line_items: Array<{
    price_data: { unit_amount: number; product_data: { name: string } };
    quantity: number;
  }>;
};

const create = vi.fn(async (_params: SessionParams) => ({
  url: "https://checkout.stripe.test/session",
}));
vi.mock("@/lib/stripe", () => ({
  stripe: () => ({ checkout: { sessions: { create } } }),
}));

import { POST } from "./route";

describe("POST /api/checkout — email must be deliverable", () => {
  // `a@b` reached this route from the live site: HTML5 type="email" accepts it
  // (no TLD required) and the client only checked non-empty. The confirmation
  // email is the only place the customer gets their order number, so an
  // undeliverable address strands a paying customer.
  const body = (email: string) => ({
    items: [{ name: "ABC Jigsaw Board", price: 15, quantity: 1, slug: "abc-jigsaw-board" }],
    customer: { email, phone: "0501234567", name: "Test Shopper" },
  });
  const post = (email: string) =>
    POST(new NextRequest("https://shop.lebon-grace.com/api/checkout", {
      method: "POST", body: JSON.stringify(body(email)),
      headers: { "content-type": "application/json" },
    }));

  it("rejects an address with no TLD", async () => {
    const res = await post("a@b");
    expect(res.status).toBe(400);
  });

  it("rejects an address with a single-character TLD", async () => {
    expect((await post("a@b.c")).status).toBe(400);
  });

  it("accepts a deliverable address — the precondition", async () => {
    // Without this, "a@b is rejected" would also pass on a route that rejects
    // everything, which is the failure mode L-2 keeps catching.
    const res = await post("real@example.com");
    expect(res.status).not.toBe(400);
  });
});


function post(body: unknown) {
  // The route now requires a deliverable email — an order whose confirmation
  // cannot arrive strands the customer, because the confirmation is the only
  // place the order number is given. These fixtures predate that and each one
  // is about PRICE integrity, so a valid customer is supplied by default and
  // any test that cares can still override it.
  const withCustomer =
    body && typeof body === "object" && !("customer" in (body as object))
      ? { ...(body as object), customer: { email: "shopper@example.com", phone: "0501234567", name: "Test Shopper" } }
      : body;
  return new NextRequest("https://shop.lebon-grace.com/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withCustomer),
  });
}

/** The line_items Stripe would have received on the most recent call. */
function sentLineItems(): SessionParams["line_items"] {
  expect(create).toHaveBeenCalled();
  const last = create.mock.calls.at(-1);
  if (!last) throw new Error("stripe session create was never called");
  return last[0].line_items;
}

beforeEach(() => create.mockClear());

describe("POST /api/checkout — price integrity", () => {
  it("charges the catalogue price, not the price the client claims", async () => {
    await POST(post({
      items: [{ slug: "abc-jigsaw-board", name: "ABC Jigsaw Board", price: 1, quantity: 1 }],
      subtotal: 1, shipping: 0, deliveryMethod: "pickup",
    }));

    // 15 AED in fils, not the 1 AED the client asked to be charged.
    expect(sentLineItems()[0].price_data.unit_amount).toBe(1500);
  });

  it("ignores a forged subtotal and recomputes from the catalogue", async () => {
    await POST(post({
      items: [
        { slug: "abc-jigsaw-board", price: 0.01, quantity: 2 },
        { slug: "phone-case-clearance", price: 0.01, quantity: 1 },
      ],
      subtotal: 0.03, shipping: 0, deliveryMethod: "pickup",
    }));

    const total = sentLineItems().reduce((s, li) => s + li.price_data.unit_amount * li.quantity, 0);
    expect(total).toBe(15 * 100 * 2 + 5 * 100); // 3500 fils
  });

  it("REGRESSION: an item without a slug must not set its own price", async () => {
    // src/app/api/checkout/route.ts had `if (!item.slug) return item;`, so an
    // item posted without a slug skipped catalogue lookup entirely and its
    // client-supplied price went straight onto the Stripe line item. The real
    // client always sends a slug — but server-side validation exists precisely
    // for the request that does not come from the real client.
    const res = await POST(post({
      items: [{ name: "Free puzzle", price: 0.01, quantity: 1 }],
      subtotal: 0.01, shipping: 0, deliveryMethod: "pickup",
    }));

    // Rejected outright is the correct outcome: with no slug there is no
    // authoritative price to fall back to.
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an unknown slug without a 500", async () => {
    const res = await POST(post({
      items: [{ slug: "not-a-real-product", price: 15, quantity: 1 }],
      subtotal: 15, shipping: 0, deliveryMethod: "pickup",
    }));

    // Previously this threw outside the try/catch, so Next surfaced a 500.
    // A bad request from a client is a 400.
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  // Renamed: it used to say "at the amount given", which is exactly what the
  // server no longer does. It still passes because 20 is what the rule computes
  // for a 15 AED delivery order — the value agrees, the reason changed (SH-03).
  it("adds delivery as its own line item, at the fee the server computed", async () => {
    await POST(post({
      items: [{ slug: "abc-jigsaw-board", price: 15, quantity: 1 }],
      subtotal: 15, shipping: 20, deliveryMethod: "delivery", emirate: "Dubai",
    }));

    const items = sentLineItems();
    expect(items).toHaveLength(2);
    expect(items[1].price_data.product_data.name).toBe("Shipping Fee");
    expect(items[1].price_data.unit_amount).toBe(2000);
  });

  it("caps the engraved name at 20 characters and trims it", async () => {
    await POST(post({
      items: [{
        slug: "abc-jigsaw-board", price: 15, quantity: 1,
        personalisation: "   " + "A".repeat(40) + "   ",
      }],
      subtotal: 15, shipping: 0, deliveryMethod: "pickup",
    }));

    const name = sentLineItems()[0].price_data.product_data.name;
    expect(name).toBe(`ABC Jigsaw Board (engraved: ${"A".repeat(20)})`);
  });

  it("rejects an empty cart", async () => {
    const res = await POST(post({ items: [], subtotal: 0, shipping: 0, deliveryMethod: "pickup" }));
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});

/**
 * The delivery fee was the one money value the server took on trust.
 *
 * Item prices are already re-read from the catalog ("ignore client subtotal"),
 * so a caller cannot set their own price. `shipping` went straight from the
 * request body into `unit_amount`, and the rule that decides it —
 * `pickup ? 0 : subtotal >= FREE_DELIVERY_OVER ? 0 : UAE_DELIVERY` — lived only
 * in `cart-context.tsx`, a client module the server never consults.
 *
 * So `{"shipping": 0}` bought free delivery, and nothing downstream could tell:
 * the order, the confirmation email and the workshop queue all record whatever
 * Stripe was told to charge (SH-03).
 */
describe("the delivery fee is computed by the server, not supplied by the caller", () => {
  const item = { slug: "abc-jigsaw-board", price: 15, quantity: 1 }; // 15 < 150

  it("charges delivery even when the caller claims it is free", async () => {
    await POST(post({
      items: [item], subtotal: 15, shipping: 0, deliveryMethod: "delivery", emirate: "Dubai",
    }));

    const items = sentLineItems();
    const fee = items.find((l: { price_data: { product_data: { name: string } } }) =>
      l.price_data.product_data.name === "Shipping Fee");
    expect(fee, "a 15 AED delivery order must be charged delivery, whatever the body said").toBeTruthy();
    expect(fee!.price_data.unit_amount).toBe(2000);
  });

  it("ignores an inflated fee too", async () => {
    // Not an attack on the shop, but the same principle: the server decides.
    await POST(post({
      items: [item], subtotal: 15, shipping: 999, deliveryMethod: "delivery", emirate: "Dubai",
    }));
    const fee = sentLineItems().find((l: { price_data: { product_data: { name: string } } }) =>
      l.price_data.product_data.name === "Shipping Fee");
    expect(fee!.price_data.unit_amount).toBe(2000);
  });

  it("still gives free delivery over the threshold", async () => {
    // PRECONDITION: proves the rule is applied, not that delivery is always charged.
    await POST(post({
      items: [{ ...item, quantity: 10 }], subtotal: 150, shipping: 20, deliveryMethod: "delivery", emirate: "Dubai",
    }));
    const names = sentLineItems().map((l: { price_data: { product_data: { name: string } } }) =>
      l.price_data.product_data.name);
    expect(names, "150 AED reaches the free-delivery threshold").not.toContain("Shipping Fee");
  });

  it("charges nothing for collection, whatever the body says", async () => {
    await POST(post({
      items: [item], subtotal: 15, shipping: 20, deliveryMethod: "pickup",
    }));
    const names = sentLineItems().map((l: { price_data: { product_data: { name: string } } }) =>
      l.price_data.product_data.name);
    expect(names).not.toContain("Shipping Fee");
  });
});

describe("POST /api/checkout — the unlisted test product", () => {
  /**
   * The internal AED 2 item exists so the money path can be exercised on the
   * live shop after every deploy. It is deliberately absent from `products`, so
   * the checkout lookup HAS to go through getProductBySlug — the earlier
   * `products.find` would have answered "Unknown product" and refused the sale.
   *
   * That is the regression this pins: unlisted must mean invisible, never
   * unsellable.
   */
  it("can be bought, even though it is not in the browsable catalogue", async () => {
    const res = await POST(post({
      items: [{ slug: "internal-test-item", name: "Internal Test Item", price: 2, quantity: 1 }],
      subtotal: 2, shipping: 0, deliveryMethod: "pickup",
    }));

    expect(res.status, "an unlisted product must still be sellable").not.toBe(400);
    // 2 AED in fils, taken from the catalogue rather than the client.
    expect(sentLineItems()[0].price_data.unit_amount).toBe(200);
  });

  it("charges the catalogue price for it, not a client-supplied one", async () => {
    // The test item is the most attractive thing in the shop to forge a price
    // on, precisely because it is cheap and unlisted.
    await POST(post({
      items: [{ slug: "internal-test-item", price: 0.01, quantity: 1 }],
      subtotal: 0.01, shipping: 0, deliveryMethod: "pickup",
    }));
    expect(sentLineItems()[0].price_data.unit_amount).toBe(200);
  });

  it("still refuses a slug that is in no catalogue at all", async () => {
    // PRECONDITION for the two above: proves the lookup did not simply start
    // accepting everything.
    const res = await POST(post({
      items: [{ slug: "not-a-real-product", price: 2, quantity: 1 }],
      subtotal: 2, shipping: 0, deliveryMethod: "pickup",
    }));
    expect(res.status).toBe(400);
  });
});
