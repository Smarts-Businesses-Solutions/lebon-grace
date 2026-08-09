/**
 * Order lookup: the phone gate on /track and /account.
 *
 * These two functions are the entire authorisation model for guest order
 * access. There are no accounts and no passwords — "your order id + your phone"
 * and "your email + your phone" ARE the credential, and a hit returns the full
 * customer record: name, email, phone, delivery address, totals, tracking. So
 * the property under test is not "the right phone works", it is that the WRONG
 * phone returns nothing.
 *
 * Supabase is stubbed at the module boundary with a chainable builder, so the
 * real query chain runs and we assert on both the filter arguments sent and the
 * rows that survive the in-JS phone filter.
 *
 * ACTION_PLAN.md A-4.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// The store reads these at module scope and throws without them, so they must
// be set before the import below — hence vi.hoisted rather than beforeEach.
const stub = vi.hoisted(() => {
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  return {
    result: { data: null as unknown, error: null as unknown },
    calls: [] as Array<{ method: string; args: unknown[] }>,
  };
});

vi.mock("@supabase/supabase-js", () => {
  const CHAINABLE = ["select", "eq", "ilike", "order", "limit", "insert", "update", "delete", "upsert"];
  const builder = () => {
    const b: Record<string, unknown> = {};
    for (const m of CHAINABLE) {
      b[m] = (...args: unknown[]) => { stub.calls.push({ method: m, args }); return b; };
    }
    b.maybeSingle = () => { stub.calls.push({ method: "maybeSingle", args: [] }); return Promise.resolve(stub.result); };
    b.single = b.maybeSingle;
    // Thenable, so `await` on an unterminated chain (.order(), .limit()) resolves.
    b.then = (resolve: (v: unknown) => void) => resolve(stub.result);
    return b;
  };
  return { createClient: () => ({ from: () => builder() }) };
});

import { orders } from "./store";

const UUID = "3f1c2b8a-9d4e-4f7a-8b21-0c5d6e7f8a9b";
const order = (over: Record<string, unknown> = {}) => ({
  id: UUID,
  customer_email: "buyer@example.com",
  customer_phone: "+971 50 123 4567",
  customer_name: "A Customer",
  ...over,
});

/** What the mocked query chain will return for the next call. */
const willReturn = (data: unknown) => { stub.result = { data, error: null }; };
const argsOf = (method: string) => stub.calls.find((c) => c.method === method)?.args;

beforeEach(() => {
  stub.calls = [];
  stub.result = { data: null, error: null };
});

describe("getByTracking — order id + phone", () => {
  it("returns the order when the phone matches", async () => {
    willReturn(order());
    expect(await orders.getByTracking(UUID, "0501234567")).toMatchObject({ id: UUID });
  });

  it("returns nothing when the phone does not match", async () => {
    // The one that matters. The order exists and was fetched; the phone is
    // what withholds it.
    willReturn(order());
    expect(await orders.getByTracking(UUID, "0509999999")).toBeNull();
  });

  it("accepts the same number in the formats a customer actually types", async () => {
    // Printed on the receipt as +971 50 123 4567; typed as any of these.
    for (const typed of ["0501234567", "+971501234567", "971501234567", "050 123 4567", "050-123-4567"]) {
      willReturn(order());
      expect(await orders.getByTracking(UUID, typed), typed).not.toBeNull();
    }
  });

  it("refuses a blank phone even when the stored phone is blank too", async () => {
    // Orders written before the webhook carried the phone through metadata have
    // an empty customer_phone. Empty-matches-empty would hand those records to
    // anyone with the order id.
    willReturn(order({ customer_phone: "" }));
    expect(await orders.getByTracking(UUID, "")).toBeNull();
  });

  it("returns nothing when no such order exists", async () => {
    willReturn(null);
    expect(await orders.getByTracking(UUID, "0501234567")).toBeNull();
  });
});

describe("getById — what may be looked up", () => {
  it("matches a full uuid exactly, not as a pattern", async () => {
    willReturn(order());
    await orders.getById(UUID);
    expect(argsOf("eq")).toEqual(["id", UUID]);
    expect(argsOf("ilike")).toBeUndefined();
  });

  it("accepts the 8-character prefix printed on the receipt", async () => {
    // TrackClient renders `#${id.slice(0, 8)}`, so this is what customers type.
    willReturn([order()]);
    expect(await orders.getById("3f1c2b8a")).toMatchObject({ id: UUID });
    expect(argsOf("ilike")).toEqual(["id", "3f1c2b8a%"]);
  });

  it("REGRESSION: a LIKE wildcard must not be treated as one", async () => {
    // `?id=*` built the pattern `*%`, and PostgREST aliases `*` to `%` so that
    // it need not be URL-encoded — the query became `%%`, matched every order
    // and returned an arbitrary one. `_` matches any single character and had
    // the same effect. Neither may reach the query at all.
    for (const probe of ["*", "%", "_", "________", "%%%%%%%%", "3f1c2b8*", "3f1c2b8_"]) {
      stub.calls = [];
      willReturn([order()]);
      expect(await orders.getById(probe), probe).toBeNull();
      expect(stub.calls, probe).toHaveLength(0);
    }
  });

  it("REGRESSION: a one-character prefix must not enumerate the table", async () => {
    // `?id=a` returned the first order whose uuid begins with "a". Sixteen
    // requests walked sixteen strangers' orders into range of a phone guess.
    for (const short of ["a", "3f", "3f1c2b"]) {
      stub.calls = [];
      willReturn([order()]);
      expect(await orders.getById(short), short).toBeNull();
      expect(stub.calls, short).toHaveLength(0);
    }
  });

  it("returns nothing for an empty id without querying", async () => {
    expect(await orders.getById("")).toBeNull();
    expect(stub.calls).toHaveLength(0);
  });
});

describe("getByEmailPhone — email + phone", () => {
  it("returns only the orders whose phone matches", async () => {
    // The email query is not a filter on phone — Postgres returns every order
    // for the address and the phone filter runs in JS. If that filter were
    // dropped, one known email would return every order placed with it,
    // including someone else's if an address is ever shared or reused.
    willReturn([
      order({ id: "mine", customer_phone: "+971501234567" }),
      order({ id: "theirs", customer_phone: "+971559999999" }),
    ]);
    const found = await orders.getByEmailPhone("buyer@example.com", "0501234567");
    expect(found.map((o) => o.id)).toEqual(["mine"]);
  });

  it("returns an empty list when the phone matches none of them", async () => {
    willReturn([order(), order({ id: "second" })]);
    expect(await orders.getByEmailPhone("buyer@example.com", "0500000000")).toEqual([]);
  });

  it("looks the email up case-insensitively, via the indexed column", async () => {
    // Stripe lowercases what the customer typed; the account form does not.
    //
    // Pins the indexed path (0003). This was `.ilike("customer_email", email)`
    // with no wildcards — case-insensitive equality written with a pattern
    // operator, which cannot use a btree index, so every lookup scanned the
    // whole orders table. If it ever reverts, the seq scan comes back silently:
    // correct results, quietly getting slower as orders accumulate.
    willReturn([]);
    await orders.getByEmailPhone("  Buyer@Example.com  ", "0501234567");
    expect(argsOf("eq")).toEqual(["customer_email_lc", "buyer@example.com"]);
    expect(argsOf("ilike")).toBeUndefined();
  });
});

describe("getBySessionId — webhook idempotency lookup", () => {
  it("matches the Stripe session id exactly", async () => {
    willReturn(order({ stripe_session_id: "cs_test_1" }));
    await orders.getBySessionId("cs_test_1");
    expect(argsOf("eq")).toEqual(["stripe_session_id", "cs_test_1"]);
  });

  it("returns null for an empty session id without querying", async () => {
    expect(await orders.getBySessionId("")).toBeNull();
    expect(stub.calls).toHaveLength(0);
  });
});
