import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Catalogue edits leave a record, and only an admin can make them.
 *
 * B-42 shipped the audit trail covering order status changes only, and said so
 * in as many words. This closes that gap: a price edit is a money change that
 * left no receipt — the row simply held a different number afterwards, and "was
 * this always 15 AED?" had no answer. A delete had no record at all, and it is
 * the one action with no undo.
 *
 * These are also the first tests this route has ever had, so the admin guard is
 * pinned here too: it is the only thing standing between a stranger and the
 * shop's prices.
 */

const m = vi.hoisted(() => ({
  upsert: vi.fn(async (_p: Record<string, unknown>) => undefined),
  remove: vi.fn(async (_slug: string) => undefined),
  getAll: vi.fn(async () => [] as unknown[]),
  requireAdmin: vi.fn(() => true),
  recordAdminAction: vi.fn(),
}));

vi.mock("@/lib/store", () => ({
  catalog: { upsert: m.upsert, remove: m.remove, getAll: m.getAll },
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: m.requireAdmin }));
vi.mock("@/lib/audit", () => ({ recordAdminAction: m.recordAdminAction }));

import { PUT, DELETE } from "./route";

const req = (body: unknown) =>
  new NextRequest("https://shop.lebon-grace.com/api/products", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAdmin.mockReturnValue(true);
});

describe("PUT /api/products", () => {
  it("records what was changed, not merely that something was", async () => {
    await PUT(req({ slug: "abc-jigsaw-board", price: 25 }));
    expect(m.recordAdminAction).toHaveBeenCalledWith(
      "product.updated",
      "product",
      "abc-jigsaw-board",
      { fields: { price: 25 } }
    );
  });

  it("leaves updated_at out of the record", async () => {
    // It is a timestamp the code sets, not a choice the operator made, and the
    // audit row's own created_at already says when. Keeping it would pad every
    // entry with noise.
    await PUT(req({ slug: "abc-jigsaw-board", price: 25 }));
    const [, , , details] = m.recordAdminAction.mock.calls[0] as [string, string, string, { fields: Record<string, unknown> }];
    expect(Object.keys(details.fields)).not.toContain("updated_at");
  });

  it("does not record anything when the request is rejected", async () => {
    // PRECONDITION for the assertions above: the audit follows the action, it is
    // not fired on every request that reaches the route.
    const res = await PUT(req({ price: 25 })); // no slug
    expect(res.status).toBe(400);
    expect(m.recordAdminAction).not.toHaveBeenCalled();
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("refuses a caller who is not an admin, and writes nothing", async () => {
    m.requireAdmin.mockReturnValue(false);
    const res = await PUT(req({ slug: "abc-jigsaw-board", price: 1 }));
    expect(res.status).toBe(401);
    expect(m.upsert, "an unauthenticated request must not reach the catalogue").not.toHaveBeenCalled();
    expect(m.recordAdminAction).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/products", () => {
  it("records the deletion — the one action with no undo", async () => {
    await DELETE(req({ slug: "abc-jigsaw-board" }));
    expect(m.remove).toHaveBeenCalledWith("abc-jigsaw-board");
    expect(m.recordAdminAction).toHaveBeenCalledWith("product.deleted", "product", "abc-jigsaw-board", {});
  });

  it("refuses a caller who is not an admin, and deletes nothing", async () => {
    m.requireAdmin.mockReturnValue(false);
    const res = await DELETE(req({ slug: "abc-jigsaw-board" }));
    expect(res.status).toBe(401);
    expect(m.remove).not.toHaveBeenCalled();
  });
});
