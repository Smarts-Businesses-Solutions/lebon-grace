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
  getAll: vi.fn(async () => []),
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
}));

vi.mock("@/lib/store", () => ({
  orders: {
    getById: m.getById, update: m.update, getAll: m.getAll,
    getBySessionId: m.getBySessionId, getByEmailPhone: m.getByEmailPhone,
    getByTracking: m.getByTracking, insert: m.insert,
  },
}));
vi.mock("@/lib/email", () => ({ sendOrderEmail: m.sendOrderEmail }));
vi.mock("@/lib/whatsapp", () => ({ notifyWhatsApp: m.notifyWhatsApp }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: m.requireAdmin }));
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
