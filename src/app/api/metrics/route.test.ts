import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(() => true),
  getAll: vi.fn(async () => [] as Record<string, unknown>[]),
  itemsGetAll: vi.fn(async () => [] as Record<string, unknown>[]),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: m.requireAdmin }));
vi.mock("@/lib/store", () => ({
  orders: { getAll: m.getAll },
  orderItems: { getAll: m.itemsGetAll },
}));

import { GET } from "./route";

/**
 * The dashboard reported a business model that no longer exists.
 *
 * Stripe collects the full amount. There is no deposit and no cash on
 * delivery — that model was deleted from checkout. But the admin still led
 * with DEPOSITS COLLECTED, COD PENDING, COD COLLECTED and a COD OUTSTANDING
 * panel, computed from `deposit_amount` and `cod_amount` columns that now
 * always equal the total and zero.
 *
 * Four of six headline tiles were therefore either meaningless or a
 * restatement of revenue, which is worse than showing nothing: an operator
 * reading "COD PENDING AED 25" reasonably believes money is owed.
 */
const order = (over: Record<string, unknown> = {}) => ({
  id: "c6568cbb-c503-4b91-924f-39ccd7cf135c",
  customer_name: "Eva BON",
  customer_phone: "+971528399804",
  total: 2,
  deposit_amount: 2,
  cod_amount: 0,
  status: "deposit_paid",
  created_at: new Date().toISOString(),
  ...over,
});

const req = () => new NextRequest("https://shop.lebon-grace.com/api/metrics");

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAdmin.mockReturnValue(true);
  m.getAll.mockResolvedValue([order()]);
  m.itemsGetAll.mockResolvedValue([]);
});

describe("GET /api/metrics — the deleted deposit/COD model", () => {
  it("no longer reports deposits collected", async () => {
    const body = await (await GET(req())).json();
    expect(JSON.stringify(body)).not.toContain("depositsCollected");
  });

  it("no longer reports a COD block", async () => {
    const body = await (await GET(req())).json();
    expect(body.cod, "COD is not a thing any more").toBeUndefined();
  });

  it("still reports the numbers that DO mean something", async () => {
    // Precondition: the endpoint must not have been gutted. Removing COD is
    // only correct if revenue, orders and the queue survive.
    const body = await (await GET(req())).json();
    expect(body.financial?.revenueTotal).toBe(2);
    expect(body.financial?.ordersTotal).toBe(1);
    expect(body.queue).toBeDefined();
  });

  it("still refuses an unauthenticated caller", async () => {
    m.requireAdmin.mockReturnValue(false);
    expect((await GET(req())).status).toBe(401);
  });
});
