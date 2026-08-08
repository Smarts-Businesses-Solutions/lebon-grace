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
vi.mock("@/lib/products", () => ({
  products: [
    { slug: "abc-jigsaw-board", name: "ABC Jigsaw Board", price: 15, imageUrl: "/images/lasercut/abc-jigsaw-board-0.png" },
    { slug: "phone-case-clearance", name: "Phone Case Clearance", price: 5, imageUrl: "/images/clearance/phone-case-clearance-0.jpg" },
  ],
}));

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

function post(body: unknown) {
  return new NextRequest("https://shop.lebon-grace.com/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
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

  it("adds shipping as its own line item at the amount given", async () => {
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
