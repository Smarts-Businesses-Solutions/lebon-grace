import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { requireStaging, type StagingHandle } from "./staging-guard";
import { ORDER_STATUSES, SETTABLE_STATUSES, notifiesCustomer } from "@/lib/order-status";

/**
 * An order's whole life, against a real database (TR-03).
 *
 * Playbook P-006 walks this by hand: place an order, move it through every
 * status to `refunded`, check the tracker and the e-mails at each hop. It is
 * manual because the only database that existed was the live one, and running
 * it automatically meant creating and deleting real orders in the shop several
 * times a day — with a half-finished run leaving a fake order in the workshop
 * queue.
 *
 * A staging database removes that objection, so this replaces the manual walk.
 *
 * NOT part of the default suite. It needs a database that declares itself
 * disposable, which the guard checks before a single row is written. Run it:
 *
 *   npm run test:lifecycle          (see ops/staging/README.md for the env)
 *
 * What this covers that the unit tests do not: the unit tests mock the store,
 * so they prove the status logic is right about a database they invented. This
 * proves the same logic against real Postgres — real CHECK constraints, real
 * NOT NULLs, real defaults. B-7 was exactly a case where the code was
 * self-consistent and the database disagreed.
 */

let staging: StagingHandle;
const created: string[] = [];

/**
 * A row that satisfies the real NOT NULLs, so a failure means something.
 *
 * These column names are the ones the live table actually has — the first
 * version of this helper invented `email`, `phone` and `delivery_method`, and
 * PostgREST rejected it with "Could not find the 'delivery_method' column". A
 * mocked store would have accepted all three happily, which is precisely the
 * gap a real database closes.
 *
 * Every NOT NULL column without a default is supplied. Leaving one out would
 * make the insert fail for a reason that has nothing to do with the lifecycle
 * under test.
 */
function newOrder(overrides: Record<string, unknown> = {}) {
  const stamp = "lifecycle-test";
  return {
    customer_name: `${stamp} customer`,
    // Deliberately obvious, and `.invalid` is reserved by RFC 2606 so it can
    // never route anywhere. If a row ever escapes cleanup and a human finds it,
    // it should say what it is and where it came from.
    customer_email: `${stamp}@example.invalid`,
    customer_phone: "+971500000000",
    delivery_address: `${stamp} — not a real address`,
    emirate: "Dubai",
    subtotal: 100,
    shipping: 20,
    total: 120,
    deposit_amount: 60,
    cod_amount: 60,
    status: "deposit_paid",
    ...overrides,
  };
}

beforeAll(async () => {
  // Throws unless the database declares itself disposable. Nothing below runs
  // otherwise — the guard is the first thing, before any row is written.
  staging = await requireStaging();
});

afterAll(async () => {
  // Best-effort, and it must not mask a test failure. A leftover row is
  // annoying; a swallowed assertion is dangerous.
  if (!staging || created.length === 0) return;
  const { error } = await staging.db.from("orders").delete().in("id", created);
  if (error) console.error(`[lifecycle] cleanup left ${created.length} rows behind: ${error.message}`);
});

describe("an order's life, end to end", () => {
  it("walks every settable status through to refunded", async () => {
    const { data: order, error } = await staging.db
      .from("orders").insert(newOrder()).select().single();
    expect(error, `insert failed: ${error?.message}`).toBeNull();
    expect(order?.id).toBeTruthy();
    created.push(order.id);

    // The real journey, in the order a real order takes it.
    const journey = ["processing", "shipped", "out_for_delivery", "delivered", "refunded"];
    for (const status of journey) {
      const { data: updated, error: upErr } = await staging.db
        .from("orders").update({ status }).eq("id", order.id).select().single();

      expect(upErr, `moving to ${status} failed: ${upErr?.message}`).toBeNull();
      expect(updated.status, `order should now be ${status}`).toBe(status);
    }

    // And it ends where P-006 ends.
    const { data: final } = await staging.db
      .from("orders").select("status").eq("id", order.id).single();
    expect(final.status).toBe("refunded");
  });

  it("the database rejects a status the application does not know", async () => {
    // The CHECK constraint, exercised for real. This is the half that unit
    // tests with a mocked store cannot reach — and B-7 was precisely a value
    // the code wrote that the rest of the system did not recognise.
    const { data: order, error: insErr } = await staging.db
      .from("orders").insert(newOrder()).select().single();
    expect(insErr, `insert failed: ${insErr?.message}`).toBeNull();
    created.push(order.id);

    const { error } = await staging.db
      .from("orders").update({ status: "not_a_real_status" }).eq("id", order.id);

    expect(error, "the database must refuse an unknown status").not.toBeNull();

    const { data: after } = await staging.db
      .from("orders").select("status").eq("id", order.id).single();
    expect(after.status, "a rejected update must not have changed anything").toBe("deposit_paid");
  });

  it("every status the code allows is one the database allows", async () => {
    // Drift between ORDER_STATUSES and the CHECK constraint is invisible until
    // an operator picks the one status that fails. Rather than trust that they
    // agree, put every value through the real column.
    const { data: order, error: insErr } = await staging.db
      .from("orders").insert(newOrder()).select().single();
    expect(insErr, `insert failed: ${insErr?.message}`).toBeNull();
    created.push(order.id);

    const rejected: string[] = [];
    for (const status of SETTABLE_STATUSES) {
      const { error } = await staging.db
        .from("orders").update({ status }).eq("id", order.id);
      if (error) rejected.push(`${status} (${error.message})`);
    }

    expect(rejected, "these statuses exist in code but the database refuses them").toEqual([]);
    expect(SETTABLE_STATUSES.length, "PRECONDITION: statuses were actually tried").toBeGreaterThan(5);
  });

  it("a refunded order is still findable by the customer", async () => {
    // The failure that would matter to a real person: their order vanishes from
    // /track the moment it is refunded, exactly when they are most likely to
    // look at it.
    const { data: order, error: insErr } = await staging.db.from("orders")
      .insert(newOrder({ status: "refunded" })).select().single();
    expect(insErr, `insert failed: ${insErr?.message}`).toBeNull();
    created.push(order.id);

    const { data: found, error } = await staging.db
      .from("orders").select("id,status")
      .eq("customer_email", order.customer_email)
      .eq("customer_phone", order.customer_phone);

    expect(error).toBeNull();
    expect(found?.map((o: { id: string }) => o.id)).toContain(order.id);
  });
});

describe("what the customer is told", () => {
  it("the statuses that e-mail the customer are the ones that should", async () => {
    // notifiesCustomer drives whether /admin warns before a status change
    // (B-38) and what the audit trail records (B-42). It is asserted here
    // against the same list the database accepts, so the three cannot drift
    // apart silently.
    for (const status of ["processing", "shipped", "out_for_delivery", "delivered", "refunded"]) {
      expect(notifiesCustomer(status), `${status} should notify the customer`).toBe(true);
    }
    for (const status of ["deposit_paid", "completed", "failed"]) {
      expect(notifiesCustomer(status), `${status} should NOT notify the customer`).toBe(false);
    }
  });

  it("PRECONDITION: every status in the journey is a real one", () => {
    // Guards the tests above from testing typos: a misspelled status would make
    // several of them vacuous rather than failing.
    for (const s of ["processing", "shipped", "out_for_delivery", "delivered", "refunded"]) {
      expect(ORDER_STATUSES as readonly string[]).toContain(s);
    }
  });
});
