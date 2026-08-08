/**
 * The workshop queue.
 *
 * Two things here are worth more than the rest: the engraved name must be the
 * one the customer actually paid for, and the order must be strict FIFO within
 * a status. Getting the first wrong cuts a stranger's name into someone's piece,
 * and wood does not un-cut. Getting the second wrong quietly leaves the oldest
 * customer waiting longest.
 *
 * ACTION_PLAN.md A-15.
 */
import { describe, it, expect } from "vitest";
import { buildProductionQueue, engravingOf, QUEUE_STATUSES } from "./production-queue";

const NOW = new Date("2026-08-08T12:00:00Z");
const order = (over: Record<string, unknown> = {}) => ({
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  customer_name: "Amira",
  status: "deposit_paid",
  created_at: "2026-08-05T09:00:00Z",
  delivery_method: "delivery",
  emirate: "Dubai",
  ...over,
});
const item = (over: Record<string, unknown> = {}) => ({
  order_id: "aaaaaaaa-0000-0000-0000-000000000001",
  product_name: "ABC Jigsaw Board",
  quantity: 1,
  ...over,
});

describe("what is in the queue", () => {
  it("includes only pieces not yet cut and shipped", () => {
    const q = buildProductionQueue(
      [
        order({ id: "1", status: "deposit_paid" }),
        order({ id: "2", status: "processing" }),
        order({ id: "3", status: "shipped" }),
        order({ id: "4", status: "delivered" }),
        order({ id: "5", status: "cancelled" }),
        order({ id: "6", status: "refunded" }),
      ],
      [],
      NOW
    );
    expect(q.map((e) => e.id)).toEqual(["2", "1"]);
  });

  it("survives an order with no items rather than dropping it", () => {
    // An order whose line items failed to save is exactly the one the workshop
    // must still see — it is a paid order with nothing recorded to make.
    const q = buildProductionQueue([order()], [], NOW);
    expect(q).toHaveLength(1);
    expect(q[0].items).toEqual([]);
    expect(q[0].pieces).toBe(0);
  });
});

describe("order of work", () => {
  it("finishes started work before starting new work", () => {
    const q = buildProductionQueue(
      [
        order({ id: "new", status: "deposit_paid", created_at: "2026-08-01T09:00:00Z" }),
        order({ id: "started", status: "processing", created_at: "2026-08-07T09:00:00Z" }),
      ],
      [],
      NOW
    );
    // `processing` first even though it is the newer order: a half-cut piece
    // occupies the machine.
    expect(q.map((e) => e.id)).toEqual(["started", "new"]);
  });

  it("is strict FIFO within a status", () => {
    const q = buildProductionQueue(
      [
        order({ id: "mid", created_at: "2026-08-04T09:00:00Z" }),
        order({ id: "oldest", created_at: "2026-08-01T09:00:00Z" }),
        order({ id: "newest", created_at: "2026-08-07T09:00:00Z" }),
      ],
      [],
      NOW
    );
    expect(q.map((e) => e.id)).toEqual(["oldest", "mid", "newest"]);
  });

  it("does not let an order with no date jump the queue", () => {
    // An unparseable timestamp sorts as 0 in a naive comparison, which would put
    // it ahead of every real customer.
    const q = buildProductionQueue(
      [order({ id: "undated", created_at: "" }), order({ id: "real", created_at: "2026-08-01T09:00:00Z" })],
      [],
      NOW
    );
    expect(q[0].id).toBe("real");
  });

  it("reports how long each customer has been waiting", () => {
    const q = buildProductionQueue([order({ created_at: "2026-08-05T09:00:00Z" })], [], NOW);
    expect(q[0].ageDays).toBe(3);
  });
});

describe("the engraved name", () => {
  it("uses the personalisation column when present", () => {
    const q = buildProductionQueue(
      [order()],
      [item({ personalisation: "Amira", product_name: "ABC Jigsaw Board (engraved: Amira)" })],
      NOW
    );
    expect(q[0].items[0].engraving).toBe("Amira");
    expect(q[0].engraved).toBe(true);
  });

  it("strips the suffix so the piece name reads cleanly", () => {
    const q = buildProductionQueue(
      [order()],
      [item({ personalisation: "Amira", product_name: "ABC Jigsaw Board (engraved: Amira)" })],
      NOW
    );
    expect(q[0].items[0].name).toBe("ABC Jigsaw Board");
  });

  it("falls back to parsing the name for rows written before 0004", () => {
    const q = buildProductionQueue([order()], [item({ product_name: "Name Puzzle (engraved: Yousef)" })], NOW);
    expect(q[0].items[0].engraving).toBe("Yousef");
  });

  it("reports no engraving for a plain piece", () => {
    const q = buildProductionQueue([order()], [item()], NOW);
    expect(q[0].items[0].engraving).toBeNull();
    expect(q[0].engraved).toBe(false);
  });

  it("prefers the stored column over the parsed name when they disagree", () => {
    // The column is authoritative. If they ever diverge, cutting what the
    // display string happens to say is the dangerous choice.
    const q = buildProductionQueue(
      [order()],
      [item({ personalisation: "Amira", product_name: "Board (engraved: STALE)" })],
      NOW
    );
    expect(q[0].items[0].engraving).toBe("Amira");
  });

  it("handles a name containing a bracket without mangling it", () => {
    // Precisely why the column exists: the parse cannot be made reliable.
    expect(engravingOf({ personalisation: "A (B)", product_name: "Board (engraved: A (B))" })).toBe("A (B)");
  });

  it("treats a blank personalisation as no engraving", () => {
    expect(engravingOf({ personalisation: "   ", product_name: "Board" })).toBeNull();
  });
});

describe("counting", () => {
  it("counts pieces, not lines", () => {
    const q = buildProductionQueue(
      [order()],
      [item({ quantity: 3 }), item({ product_name: "Alphabet Car", quantity: 2 })],
      NOW
    );
    expect(q[0].pieces).toBe(5);
    expect(q[0].items).toHaveLength(2);
  });

  it("keeps each order's items with that order", () => {
    const q = buildProductionQueue(
      [order({ id: "1" }), order({ id: "2", created_at: "2026-08-06T09:00:00Z" })],
      [item({ order_id: "1", product_name: "One" }), item({ order_id: "2", product_name: "Two" })],
      NOW
    );
    expect(q.find((e) => e.id === "1")?.items[0].name).toBe("One");
    expect(q.find((e) => e.id === "2")?.items[0].name).toBe("Two");
  });
});

describe("queue statuses agree with the database", () => {
  it("only lists statuses the CHECK constraint permits", () => {
    // supabase/migrations/0002_add_constraints.sql. A status here that the DB
    // rejects would mean a queue that can never populate.
    const allowed = ["deposit_paid", "paid", "processing", "shipped", "out_for_delivery",
      "delivered", "completed", "cancelled", "failed", "refunded"];
    for (const s of QUEUE_STATUSES) expect(allowed).toContain(s);
  });
});
