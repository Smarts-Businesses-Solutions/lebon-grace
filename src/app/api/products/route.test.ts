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
  adminActor: vi.fn((_r: unknown) => "wanresionne@gmail.com" as string | null),
  recordAdminAction: vi.fn(),
}));

vi.mock("@/lib/store", () => ({
  catalog: { upsert: m.upsert, remove: m.remove, getAll: m.getAll },
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: m.requireAdmin, adminActor: m.adminActor }));
vi.mock("@/lib/audit", () => ({ recordAdminAction: m.recordAdminAction }));

import { GET, PUT, DELETE } from "./route";

const req = (body: unknown) =>
  new NextRequest("https://shop.lebon-grace.com/api/products", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAdmin.mockReturnValue(true);
  m.adminActor.mockReturnValue("wanresionne@gmail.com");
});

describe("PUT /api/products", () => {
  it("records what was changed, not merely that something was", async () => {
    await PUT(req({ slug: "abc-jigsaw-board", price: 25 }));
    expect(m.recordAdminAction).toHaveBeenCalledWith(
      "product.updated",
      "product",
      "abc-jigsaw-board",
      { fields: { price: 25 } },
      "wanresionne@gmail.com"
    );
  });

  it("leaves updated_at out of the record", async () => {
    // It is a timestamp the code sets, not a choice the operator made, and the
    // audit row's own created_at already says when. Keeping it would pad every
    // entry with noise.
    await PUT(req({ slug: "abc-jigsaw-board", price: 25 }));
    const [, , , details] = m.recordAdminAction.mock.calls[0] as [string, string, string, { fields: Record<string, unknown> }, string];
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
    expect(m.recordAdminAction).toHaveBeenCalledWith(
      "product.deleted",
      "product",
      "abc-jigsaw-board",
      {},
      "wanresionne@gmail.com"
    );
  });

  it("refuses a caller who is not an admin, and deletes nothing", async () => {
    m.requireAdmin.mockReturnValue(false);
    const res = await DELETE(req({ slug: "abc-jigsaw-board" }));
    expect(res.status).toBe(401);
    expect(m.remove).not.toHaveBeenCalled();
  });
});

describe("who gets the blame", () => {
  it("takes the operator from the signed session, NOT the request body", async () => {
    // The whole point of the trail. If the body could name the actor, anyone
    // who reached this route could file their edits under someone else — and a
    // trail that names the wrong person is worse than one that names nobody,
    // because it gets believed.
    m.adminActor.mockReturnValue("wanresionne@gmail.com");
    await PUT(req({ slug: "abc-jigsaw-board", price: 25, actor: "someone.else@example.com" }));
    const [, , , , actor] = m.recordAdminAction.mock.calls[0] as [string, string, string, unknown, string];
    expect(actor).toBe("wanresionne@gmail.com");
  });

  it("records a shared-password session as unattributed rather than inventing a name", async () => {
    // "" is a genuine session with no name — a legacy cookie, or the fallback
    // password. It must not become a plausible fiction on its way to the column.
    m.adminActor.mockReturnValue("");
    await PUT(req({ slug: "abc-jigsaw-board", price: 25 }));
    const [, , , , actor] = m.recordAdminAction.mock.calls[0] as [string, string, string, unknown, string];
    expect(actor).toBe("");
  });
});

describe("GET /api/products — this is not public data", () => {
  /**
   * GET was unauthenticated while PUT and DELETE were gated, and proxy.ts
   * allowlists the path with a comment saying exactly that — so it was a
   * deliberate call, made on the reasonable-sounding belief that a shop's
   * catalogue is public information.
   *
   * It stopped being true once supplier data landed in the rows. On
   * 2026-08-13 the live endpoint returned 611 entries to an unauthenticated
   * caller: the whole products table, including 569 retired products and
   * `cj_price` on 515 of them. That is the supplier's cost, so it is the
   * shop's margin, readable by anyone who guesses the URL.
   *
   * The only consumer is /admin, which already sends the cookie, so gating it
   * costs nothing.
   */
  const getReq = () => new NextRequest("https://shop.lebon-grace.com/api/products");

  it("refuses an unauthenticated caller", async () => {
    m.requireAdmin.mockReturnValue(false);
    const res = await GET(getReq());
    expect(res.status).toBe(401);
  });

  it("does not even read the catalogue when refused", async () => {
    // Status alone is not enough: a handler that fetches, then returns 401,
    // still does the work and can leak through logs or timing.
    m.requireAdmin.mockReturnValue(false);
    await GET(getReq());
    expect(m.getAll).not.toHaveBeenCalled();
  });

  it("still serves an authenticated admin — the precondition", async () => {
    // Without this, the two above would pass on a handler that refuses
    // everyone, which would silently break the admin product manager.
    m.requireAdmin.mockReturnValue(true);
    m.getAll.mockResolvedValueOnce([{ slug: "abc-jigsaw-board", cj_price: "3.10" }]);
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
    expect(m.getAll).toHaveBeenCalled();
  });
});
