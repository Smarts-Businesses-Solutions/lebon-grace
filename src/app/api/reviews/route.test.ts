/**
 * Reviews: every rating shown must be backed by a real order.
 *
 * The shop currently ships no ratings at all, deliberately — src/app/page.tsx
 * :9-25 records that the previous version derived stars from the product's array
 * index while not one review existed, and that invented ratings carry real
 * exposure under UAE Federal Law No. 15 of 2020 on Consumer Protection.
 *
 * So the bar for putting ratings back is not "reviews exist", it is that a
 * review cannot be created without a delivered order that actually contained
 * the piece. Migration 0005 makes the order link a FOREIGN KEY; these tests
 * cover the three things a foreign key cannot say.
 *
 * ACTION_PLAN.md A-18.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  getByTracking: vi.fn(async (_id: string, _phone: string) => null as Record<string, unknown> | null),
  getAllItems: vi.fn(async () => [] as Record<string, unknown>[]),
  existsFor: vi.fn(async (_o: string, _s: string) => false),
  insertReview: vi.fn(async (r: Record<string, unknown>) => ({ id: "rev1", ...r })),
  getBySlug: vi.fn(async (_s: string) => [] as unknown[]),
  aggregates: vi.fn(async () => ({})),
  rateLimit: vi.fn(() => null as unknown),
}));

vi.mock("@/lib/store", () => ({
  orders: { getByTracking: m.getByTracking },
  orderItems: { getAll: m.getAllItems },
  reviews: { existsFor: m.existsFor, insert: m.insertReview, getBySlug: m.getBySlug, aggregates: m.aggregates },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));

import { POST, GET } from "./route";

const ORDER_ID = "3f1c2b8a-9d4e-4f7a-8b21-0c5d6e7f8a9b";
const delivered = (over: Record<string, unknown> = {}) => ({
  id: ORDER_ID, status: "delivered", customer_name: "Amira", ...over,
});
const post = (body: unknown) =>
  new NextRequest("https://shop.lebon-grace.com/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const good = {
  orderId: ORDER_ID, phone: "0501234567", slug: "abc-jigsaw-board", rating: 5, comment: "Lovely piece.",
};

beforeEach(() => {
  vi.clearAllMocks();
  m.rateLimit.mockReturnValue(null);
  m.getByTracking.mockResolvedValue(delivered());
  m.getAllItems.mockResolvedValue([{ order_id: ORDER_ID, product_slug: "abc-jigsaw-board" }]);
  m.existsFor.mockResolvedValue(false);
  // clearAllMocks resets calls but NOT implementations, so a mockRejectedValue
  // set by one test leaks into every later one. This was not hypothetical: the
  // 23505 duplicate test made a subsequent valid submission return 409.
  m.insertReview.mockImplementation(async (r: Record<string, unknown>) => ({ id: "rev1", ...r }));
});

describe("a review requires a real, delivered order containing the piece", () => {
  it("accepts one that satisfies all three", async () => {
    const res = await POST(post(good));
    expect(res.status).toBe(201);
    expect(m.insertReview).toHaveBeenCalledTimes(1);
    expect(m.insertReview.mock.calls[0][0]).toMatchObject({
      order_id: ORDER_ID, product_slug: "abc-jigsaw-board", rating: 5,
    });
  });

  it("rejects a wrong phone", async () => {
    // getByTracking applies the phone gate; a mismatch returns null there.
    m.getByTracking.mockResolvedValue(null);
    const res = await POST(post({ ...good, phone: "0509999999" }));
    expect(res.status).toBe(404);
    expect(m.insertReview).not.toHaveBeenCalled();
  });

  it("rejects an order that has not been delivered", async () => {
    m.getByTracking.mockResolvedValue(delivered({ status: "processing" }));
    const res = await POST(post(good));
    expect(res.status).toBe(409);
    expect(m.insertReview).not.toHaveBeenCalled();
  });

  it("REGRESSION: an order cannot review a product it never contained", async () => {
    // Without this check, one delivered order could review the whole catalogue —
    // the index-derived fake ratings again, with extra steps.
    m.getAllItems.mockResolvedValue([{ order_id: ORDER_ID, product_slug: "something-else" }]);
    const res = await POST(post(good));
    expect(res.status).toBe(403);
    expect(m.insertReview).not.toHaveBeenCalled();
  });

  it("accepts `completed` as delivered", async () => {
    m.getByTracking.mockResolvedValue(delivered({ status: "completed" }));
    expect((await POST(post(good))).status).toBe(201);
  });
});

describe("one review per piece per order", () => {
  it("refuses a second review of the same piece", async () => {
    m.existsFor.mockResolvedValue(true);
    const res = await POST(post(good));
    expect(res.status).toBe(409);
    expect(m.insertReview).not.toHaveBeenCalled();
  });

  it("treats the unique-constraint violation as a duplicate, not a crash", async () => {
    // Two submits racing past the check above.
    m.insertReview.mockRejectedValue(Object.assign(new Error("dup"), { code: "23505" }));
    expect((await POST(post(good))).status).toBe(409);
  });
});

describe("what a reviewer may not choose", () => {
  it("uses the order's own name, not one supplied in the request", async () => {
    // Otherwise a reviewer could sign someone else's name to their opinion.
    await POST(post({ ...good, customer_name: "Someone Else" }));
    expect(m.insertReview.mock.calls[0][0]).toMatchObject({ customer_name: "Amira" });
  });

  it.each([0, 6, -1, 99, Number.NaN, "five"])("rejects a rating of %s", async (rating) => {
    const res = await POST(post({ ...good, rating }));
    expect(res.status).toBe(400);
    expect(m.insertReview).not.toHaveBeenCalled();
  });

  it("rounds a fractional rating to a whole star", async () => {
    // The column is a smallint, so this has to resolve somewhere. Rounding at
    // the edge is friendlier than refusing a slider that emitted 4.5.
    await POST(post({ ...good, rating: 4.5 }));
    expect(m.insertReview.mock.calls[0][0]).toMatchObject({ rating: 5 });
  });

  it("caps an overlong comment rather than rejecting the review", async () => {
    await POST(post({ ...good, comment: "x".repeat(5000) }));
    expect(String(m.insertReview.mock.calls[0][0].comment)).toHaveLength(1000);
  });

  it("stores null rather than an empty string for no comment", async () => {
    await POST(post({ ...good, comment: "   " }));
    expect(m.insertReview.mock.calls[0][0].comment).toBeNull();
  });

  it("is rate limited like the order lookup", async () => {
    m.rateLimit.mockReturnValue(new Response("slow down", { status: 429 }));
    const res = await POST(post(good));
    expect(res.status).toBe(429);
    expect(m.getByTracking).not.toHaveBeenCalled();
  });
});

describe("GET", () => {
  it("returns reviews for one product", async () => {
    m.getBySlug.mockResolvedValue([{ id: "r1", rating: 5 }]);
    const res = await GET(new NextRequest("https://x.test/api/reviews?slug=abc-jigsaw-board"));
    expect(await res.json()).toEqual({ reviews: [{ id: "r1", rating: 5 }] });
  });

  it("returns the aggregate map when no slug is given", async () => {
    m.aggregates.mockResolvedValue({ "abc-jigsaw-board": { average: 4.5, count: 2 } });
    const res = await GET(new NextRequest("https://x.test/api/reviews"));
    expect(await res.json()).toEqual({ aggregates: { "abc-jigsaw-board": { average: 4.5, count: 2 } } });
  });
});
