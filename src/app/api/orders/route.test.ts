/**
 * Admin order updates: notify on a real transition, and only once.
 *
 * The acceptance criterion for A-14 is "moving an order to `shipped` sends
 * exactly one email; moving it twice sends one". Saving an admin form twice is
 * ordinary behaviour — a double-click, a re-save after fixing a typo in the
 * tracking number — and each spurious send is a customer being told their order
 * shipped again.
 *
 * ACTION_PLAN.md A-14.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  getById: vi.fn(async (_id: string) => ({ id: "o1", status: "processing" }) as Record<string, unknown> | null),
  update: vi.fn(async (_id: string, _u: Record<string, unknown>) => ({ id: "o1", status: "shipped" }) as Record<string, unknown> | null),
  getAll: vi.fn(async () => [] as Record<string, unknown>[]),
  getBySessionId: vi.fn(async () => null),
  getByEmailPhone: vi.fn(async () => []),
  getByTracking: vi.fn(async () => null),
  insert: vi.fn(async () => ({ id: "o1" })),
  // Params are declared so `mock.calls[n][i]` is typed — a bare `vi.fn()`
  // infers an empty tuple and indexing it is a compile error.
  sendOrderEmail: vi.fn(async (_order: Record<string, unknown>, _action: string) => true),
  notifyWhatsApp: vi.fn(async (_order: Record<string, unknown>) => undefined),
  requireAdmin: vi.fn(() => true),
  rateLimit: vi.fn(() => null),
  itemsGetAll: vi.fn(async () => [] as Record<string, unknown>[]),
}));

vi.mock("@/lib/store", () => ({
  orders: {
    getById: m.getById, update: m.update, getAll: m.getAll,
    getBySessionId: m.getBySessionId, getByEmailPhone: m.getByEmailPhone,
    getByTracking: m.getByTracking, insert: m.insert,
  },
  orderItems: { getAll: m.itemsGetAll },
}));
vi.mock("@/lib/email", () => ({ sendOrderEmail: m.sendOrderEmail }));
vi.mock("@/lib/whatsapp", () => ({ notifyWhatsApp: m.notifyWhatsApp }));
vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: m.requireAdmin,
  // The route reads the operator from the signed cookie (AD-02). Mocking
  // the module means every export the route imports must be present here,
  // or it is undefined at call time and the route throws.
  adminActor: () => "wanresionne@gmail.com",
}));
vi.mock("@/lib/audit", () => ({ recordAdminAction: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));

import { PUT, GET } from "./route";

const put = (body: unknown) =>
  new NextRequest("https://shop.lebon-grace.com/api/orders", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAdmin.mockReturnValue(true);
  m.getById.mockResolvedValue({ id: "o1", status: "processing" });
  m.update.mockResolvedValue({ id: "o1", status: "shipped" });
});

describe("PUT /api/orders — notify once per real transition", () => {
  it("sends exactly one email when the status actually changes", async () => {
    const res = await PUT(put({ id: "o1", status: "shipped" }));
    expect(res.status).toBe(200);
    expect(m.sendOrderEmail).toHaveBeenCalledTimes(1);
    expect(m.sendOrderEmail.mock.calls[0][1]).toBe("shipped");
  });

  it("sends nothing when the same status is saved again", async () => {
    // The acceptance criterion. The order is ALREADY shipped, so this save is a
    // no-op transition — a second click, or a re-save to correct the tracking
    // number — and must not re-notify.
    m.getById.mockResolvedValue({ id: "o1", status: "shipped" });
    await PUT(put({ id: "o1", status: "shipped" }));
    expect(m.sendOrderEmail).not.toHaveBeenCalled();
    expect(m.notifyWhatsApp).not.toHaveBeenCalled();
  });

  it("sends nothing when only the tracking number is edited", async () => {
    await PUT(put({ id: "o1", tracking_number: "TRK999" }));
    expect(m.update).toHaveBeenCalled();
    expect(m.sendOrderEmail).not.toHaveBeenCalled();
  });

  it("notifies again on a genuine second transition", async () => {
    // Guarding against double-sends must not become "never sends twice".
    m.getById.mockResolvedValue({ id: "o1", status: "shipped" });
    m.update.mockResolvedValue({ id: "o1", status: "delivered" });
    await PUT(put({ id: "o1", status: "delivered" }));
    expect(m.sendOrderEmail).toHaveBeenCalledTimes(1);
    expect(m.sendOrderEmail.mock.calls[0][1]).toBe("delivered");
  });

  it("passes the new tracking number to the email, not the stale one", async () => {
    m.update.mockResolvedValue({ id: "o1", status: "shipped", tracking_number: "OLD" });
    await PUT(put({ id: "o1", status: "shipped", tracking_number: "NEW" }));
    expect(m.sendOrderEmail.mock.calls[0][0]).toMatchObject({ tracking_number: "NEW" });
  });

  it("rejects a non-admin without touching the order", async () => {
    m.requireAdmin.mockReturnValue(false);
    const res = await PUT(put({ id: "o1", status: "shipped" }));
    expect(res.status).toBe(401);
    expect(m.update).not.toHaveBeenCalled();
    expect(m.sendOrderEmail).not.toHaveBeenCalled();
  });

  it("404s on an order that does not exist", async () => {
    m.update.mockResolvedValue(null);
    const res = await PUT(put({ id: "nope", status: "shipped" }));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/orders — the admin listing stays admin-only", () => {
  it("refuses to list every order to an unauthenticated caller", async () => {
    // This branch returns every customer's name, email, phone and address.
    m.requireAdmin.mockReturnValue(false);
    const res = await GET(new NextRequest("https://shop.lebon-grace.com/api/orders"));
    expect(res.status).toBe(401);
    expect(m.getAll).not.toHaveBeenCalled();
  });
});

/**
 * A bad status used to come back as "Order not found".
 *
 * `orderStore.update()` swallows a database error and returns null, and the
 * route read that null as "no such order" — so an operator who mistyped a
 * status was told their order had vanished. The order was fine; the value was
 * not. Wrong diagnosis, and the expensive kind: it sends someone looking for a
 * lost order.
 */
describe("PUT /api/orders — the status has to be a real one", () => {
  it("400s on a status the database would reject, and does not attempt the write", async () => {
    const res = await PUT(put({ id: "o1", status: "not_a_status" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not a status/i);
    // The point: it fails at validation, not by bouncing off the database.
    expect(m.update, "an invalid status must not reach the store").not.toHaveBeenCalled();
  });

  it("400s on `paid`, which would hide the order from the cutting queue", async () => {
    // B-7's shape: `paid` is not in QUEUE_STATUSES, so an order moved into it
    // disappears from the workshop's list while still looking paid to the
    // customer. The database CHECK allows it; the operator must not.
    const res = await PUT(put({ id: "o1", status: "paid" }));
    expect(res.status).toBe(400);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("still 404s when the order genuinely does not exist", async () => {
    // Precondition for the above: the 404 path is real and still reachable, so
    // the 400s are a new distinction rather than a blanket replacement.
    m.update.mockResolvedValue(null);
    const res = await PUT(put({ id: "nope", status: "shipped" }));
    expect(res.status).toBe(404);
  });

  it("lets a legitimate status through untouched", async () => {
    const res = await PUT(put({ id: "o1", status: "shipped" }));
    expect(res.status).toBe(200);
    expect(m.update).toHaveBeenCalledWith("o1", expect.objectContaining({ status: "shipped" }));
  });

  it("allows an update that does not touch the status at all", async () => {
    const res = await PUT(put({ id: "o1", tracking_number: "ABC123" }));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/orders — what is actually in the order", () => {
  /**
   * The orders table showed totals and a status dropdown and nothing else.
   * To find out what a customer had actually bought — which piece, what name
   * to engrave — an operator had to read the confirmation e-mail or the
   * cutting queue, because clicking an order did nothing.
   *
   * That is the complaint the research names directly: makers "open order
   * after order just to see what to make". The engraving is the whole product
   * here, so it cannot live only in a queue that empties.
   *
   * Items ride along with the admin listing rather than a per-order fetch: the
   * dashboard already pulls every item once and groups in memory, and a click
   * that costs a round trip discourages the looking.
   */
  it("includes each order's items for an admin", async () => {
    m.requireAdmin.mockReturnValue(true);
    m.getAll.mockResolvedValue([{ id: "ord_1", customer_name: "Eva", total: 2, status: "deposit_paid" }]);
    m.itemsGetAll.mockResolvedValue([
      { order_id: "ord_1", product_name: "Internal Test Item", quantity: 1, price: 2, personalisation: "Eva" },
      { order_id: "ord_other", product_name: "Not this one", quantity: 9, price: 99 },
    ]);

    const res = await GET(new NextRequest("https://shop.lebon-grace.com/api/orders"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body[0].items, "no items on the order").toHaveLength(1);
    expect(body[0].items[0].product_name).toBe("Internal Test Item");
    // The engraving is the reason to look at all.
    expect(body[0].items[0].personalisation).toBe("Eva");
  });

  it("does not leak another order's items into this one", async () => {
    m.requireAdmin.mockReturnValue(true);
    m.getAll.mockResolvedValue([{ id: "ord_1", customer_name: "Eva", total: 2, status: "deposit_paid" }]);
    m.itemsGetAll.mockResolvedValue([{ order_id: "ord_other", product_name: "Someone else's", quantity: 1, price: 5 }]);

    const body = await (await GET(new NextRequest("https://shop.lebon-grace.com/api/orders"))).json();
    expect(body[0].items).toEqual([]);
  });

  it("still refuses an unauthenticated caller", async () => {
    // Precondition: adding items must not have opened the listing up. It
    // returns every customer's name, phone and address.
    m.requireAdmin.mockReturnValue(false);
    const res = await GET(new NextRequest("https://shop.lebon-grace.com/api/orders"));
    expect(res.status).toBe(401);
  });
});
