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
  sendOperatorNotice: vi.fn(async (_subject: string, _html: string) => true),
  getByTracking: vi.fn(async (_id: string, _phone: string) => null as Record<string, unknown> | null),
  getAllItems: vi.fn(async () => [] as Record<string, unknown>[]),
  getItemsByOrder: vi.fn(async (_orderId: string) => [] as Record<string, unknown>[]),
  existsFor: vi.fn(async (_o: string, _s: string) => false),
  insertReview: vi.fn(async (r: Record<string, unknown>) => ({ id: "rev1", ...r })),
  getBySlug: vi.fn(async (_s: string) => [] as unknown[]),
  getReviewsByOrder: vi.fn(async (_o: string) => [] as Record<string, unknown>[]),
  aggregates: vi.fn(async () => ({})),
  rateLimit: vi.fn(() => null as unknown),
}));

vi.mock("@/lib/store", () => ({
  orders: { getByTracking: m.getByTracking },
  orderItems: { getAll: m.getAllItems, getByOrder: m.getItemsByOrder },
  reviews: { existsFor: m.existsFor, insert: m.insertReview, getBySlug: m.getBySlug, aggregates: m.aggregates, getByOrder: m.getReviewsByOrder },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));
// Spread the REAL module and override only what must not fire. `esc` is
// deliberately left real: stubbing it would make every assertion below pass
// against an alert that escapes nothing. Safe because email.ts constructs its
// Resend client lazily inside mailer(), so importing it sends nothing.
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendOperatorNotice: m.sendOperatorNotice,
}));

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
  m.getItemsByOrder.mockResolvedValue([{ order_id: ORDER_ID, product_slug: "abc-jigsaw-board" }]);
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
    m.getItemsByOrder.mockResolvedValue([{ order_id: ORDER_ID, product_slug: "something-else" }]);
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

/**
 * The ownership check must ask the database for ONE order's items.
 *
 * It called `orderItems.getAll()` and filtered in JavaScript, reading every
 * order item in the table into memory on each submission — while
 * `idx_order_items_order_id` had existed since the baseline and was never
 * asked for. Same shape as A-12, where an index existed and `.ilike` stopped
 * the planner using it.
 *
 * Behaviour is identical either way, so a test that only checks the response
 * cannot tell the two apart. This pins the query instead: the scoped fetch is
 * used, and the whole-table read is not.
 *
 * Not a correctness bug today — PGRST_DB_MAX_ROWS is unset on this estate's
 * PostgREST containers (checked, not assumed), so nothing was being silently
 * truncated. It is the cost that was wrong.
 */
describe("the ownership check reads one order, not the whole table", () => {
  it("fetches items scoped to the order and never calls getAll", async () => {
    const res = await POST(post(good));
    expect(res.status).toBe(201);
    expect(m.getItemsByOrder).toHaveBeenCalledWith(ORDER_ID);
    expect(m.getAllItems, "the whole order_items table must not be read").not.toHaveBeenCalled();
  });

  it("still refuses a piece that was not in the order", async () => {
    // Precondition for the assertion above: the scoped fetch is doing the real
    // gate work, not merely being called and ignored.
    m.getItemsByOrder.mockResolvedValue([{ order_id: ORDER_ID, product_slug: "a-different-piece" }]);
    const res = await POST(post(good));
    expect(res.status).toBe(403);
  });
});

/**
 * A review is published the instant it is submitted — there is no approval
 * flag, no queue, nothing to moderate. That is a deliberate choice for a shop
 * with a verified-purchase gate, but it means a one-star review, or a comment
 * that should not be on a family business's product page, goes live and the
 * operator's only way of learning about it is to browse their own shop.
 *
 * The notice does not hold the review back. It just means somebody knows.
 */
describe("POST /api/reviews — the operator hears about it", () => {
  it("tells the operator when a review is published", async () => {
    const res = await POST(post({ ...good, rating: 2, comment: "Arrived chipped" }));
    expect(res.status).toBe(201);
    expect(m.sendOperatorNotice, "a published review must reach the operator").toHaveBeenCalled();
    const [subject, html] = m.sendOperatorNotice.mock.calls[0];
    expect(`${subject} ${html}`).toContain("abc-jigsaw-board");
    expect(`${subject} ${html}`).toContain("Arrived chipped");
  });

  it("does NOT notify when the review was rejected", async () => {
    // PRECONDITION for the assertion above: proves the notice is tied to a
    // successful insert and not fired on every request that reaches the route.
    m.existsFor.mockResolvedValue(true);
    const res = await POST(post(good));
    expect(res.status).toBe(409);
    expect(m.sendOperatorNotice).not.toHaveBeenCalled();
  });

  it("still publishes the review when the notice cannot be sent", async () => {
    // The reviewer must not be shown a failure because the shop's mail is down.
    m.sendOperatorNotice.mockRejectedValueOnce(new Error("resend down"));
    const res = await POST(post(good));
    expect(res.status).toBe(201);
  });
});

it("escapes a comment that would otherwise break the alert apart", async () => {
  // Proves the escaping happens HERE, at the call site. esc has its own
  // unit tests; this asserts the route actually reaches for it.
  await POST(post({ ...good, comment: `<b>bold</b> & "quoted"` }));
  const [, html] = m.sendOperatorNotice.mock.calls[0];
  expect(html).toContain("&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;");
  expect(html).not.toContain("<b>bold</b>");
});

/**
 * RV-01: the eligibility GET pulled every order item in the table.
 *
 * The POST was fixed to use `getByOrder` and the GET was left on `getAll()` —
 * the same "the fix missed its sibling" shape as B-33, in a different file. It
 * is behind the order-id + phone gate so it is not an open scan, but it grows
 * with the whole table to answer a question about one order, and
 * `idx_order_items_order_id` sat unused for it.
 */
describe("GET /api/reviews?order=…&phone=… — scoped to the order", () => {
  it("fetches items for the order and never calls getAll", async () => {
    m.getByTracking.mockResolvedValue(delivered());
    m.getItemsByOrder.mockResolvedValue([{ order_id: ORDER_ID, product_slug: "abc-jigsaw-board", product_name: "ABC" }]);

    const res = await GET(new NextRequest(`https://x.test/api/reviews?order=${ORDER_ID}&phone=0501234567`));
    expect(res.status).toBe(200);
    expect(m.getItemsByOrder, "must ask for this order's items").toHaveBeenCalledWith(String(ORDER_ID));
    expect(m.getAllItems, "must not pull the whole order_items table").not.toHaveBeenCalled();
  });
});
