/**
 * Admin login throttle.
 *
 * The point of this layer is the one thing the in-memory limiter cannot do:
 * remember across a restart. `rate-limit.ts` keeps buckets in a Map, so every
 * deploy zeroes them — and there were eight deploys on 2026-08-04 alone. An
 * attacker never had to outlast the window, only to still be running when
 * someone shipped.
 *
 * ACTION_PLAN.md A-21, finding S-3.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const q = vi.hoisted(() => ({
  rows: [] as Array<{ attempted_at: string }>,
  error: null as { message: string } | null,
  inserted: [] as Record<string, unknown>[],
  deletes: [] as Array<Record<string, unknown>>,
  filters: [] as Array<[string, unknown]>,
}));

vi.mock("@supabase/supabase-js", () => {
  const builder = (kind: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lt", "order"]) {
      b[m] = (...args: unknown[]) => {
        if (kind === "delete") q.deletes.push({ m, args });
        else if (args.length === 2) q.filters.push([String(args[0]), args[1]]);
        return b;
      };
    }
    b.then = (resolve: (v: unknown) => void) => resolve({ data: q.rows, error: q.error });
    return b;
  };
  return {
    createClient: () => ({
      from: () => ({
        select: (...a: unknown[]) => { const b = builder("select"); return (b.select as (...x: unknown[]) => unknown)(...a); },
        insert: async (row: Record<string, unknown>) => { q.inserted.push(row); return { error: null }; },
        delete: () => builder("delete"),
      }),
    }),
  };
});

const NOW = new Date("2026-08-08T12:00:00Z");
const agoMs = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60_000;

beforeEach(() => {
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  q.rows = []; q.error = null; q.inserted = []; q.deletes = []; q.filters = [];
  vi.resetModules();
});

/** Fresh import each time so the module-level client cache does not leak. */
async function mod() { return await import("./login-throttle"); }

describe("blocking", () => {
  it("allows an address with no history", async () => {
    const { checkLoginThrottle } = await mod();
    expect(await checkLoginThrottle("1.2.3.4", NOW)).toMatchObject({ blocked: false, failures: 0 });
  });

  it("allows four failures and blocks the fifth", async () => {
    const { checkLoginThrottle, MAX_FAILURES } = await mod();
    q.rows = Array.from({ length: MAX_FAILURES - 1 }, () => ({ attempted_at: agoMs(MIN) }));
    expect((await checkLoginThrottle("1.2.3.4", NOW)).blocked).toBe(false);
    q.rows.push({ attempted_at: agoMs(MIN) });
    expect((await checkLoginThrottle("1.2.3.4", NOW)).blocked).toBe(true);
  });

  it("counts only failed attempts", async () => {
    // A success must not spend the address's budget.
    const { checkLoginThrottle } = await mod();
    await checkLoginThrottle("1.2.3.4", NOW);
    expect(q.filters).toContainEqual(["succeeded", false]);
  });

  it("expires the block from the OLDEST failure, not the newest", async () => {
    // Otherwise a bot hammering the endpoint keeps resetting its own sentence
    // and the address is locked out forever.
    const { checkLoginThrottle, WINDOW_MS } = await mod();
    q.rows = [
      { attempted_at: agoMs(14 * MIN) }, // oldest — block should lift in ~1 min
      { attempted_at: agoMs(MIN) }, { attempted_at: agoMs(MIN) },
      { attempted_at: agoMs(MIN) }, { attempted_at: agoMs(MIN) },
    ];
    const state = await checkLoginThrottle("1.2.3.4", NOW);
    expect(state.blocked).toBe(true);
    expect(state.retryAfterSeconds).toBeLessThanOrEqual(WINDOW_MS / 1000 - 13 * 60);
    expect(state.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("only looks inside the window", async () => {
    const { checkLoginThrottle } = await mod();
    await checkLoginThrottle("1.2.3.4", NOW);
    const gte = q.filters.find(([k]) => k === "attempted_at");
    expect(gte).toBeDefined();
  });
});

describe("failure modes", () => {
  it("fails OPEN when the database cannot be read", async () => {
    // Failing closed would turn a database blip into "nobody can administer the
    // shop" — a worse outage than the one being prevented. The in-memory
    // limiter is still in front of this.
    const { checkLoginThrottle } = await mod();
    q.error = { message: "connection refused" };
    expect(await checkLoginThrottle("1.2.3.4", NOW)).toMatchObject({ blocked: false });
  });

  it("does nothing when Supabase is not configured", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    vi.resetModules();
    const { checkLoginThrottle } = await mod();
    expect((await checkLoginThrottle("1.2.3.4", NOW)).blocked).toBe(false);
  });

  it("ignores an unknown IP rather than throttling everyone behind it", async () => {
    const { checkLoginThrottle, recordLoginAttempt } = await mod();
    expect((await checkLoginThrottle("unknown", NOW)).blocked).toBe(false);
    await recordLoginAttempt("unknown", false, NOW);
    expect(q.inserted).toHaveLength(0);
  });
});

describe("recording", () => {
  it("writes a failure", async () => {
    const { recordLoginAttempt } = await mod();
    await recordLoginAttempt("1.2.3.4", false, NOW);
    expect(q.inserted[0]).toMatchObject({ ip: "1.2.3.4", succeeded: false });
  });

  it("clears the address's failures on a success", async () => {
    // An admin who mistypes three times and then gets in must not spend the
    // rest of the window locked out of their own shop.
    const { recordLoginAttempt } = await mod();
    await recordLoginAttempt("1.2.3.4", true, NOW);
    expect(q.inserted[0]).toMatchObject({ succeeded: true });
    expect(q.deletes.length).toBeGreaterThan(0);
  });

  it("prunes old rows opportunistically", async () => {
    // There is no scheduler in this estate, so the cheapest reliable place is
    // the rare path that already writes.
    const { recordLoginAttempt } = await mod();
    await recordLoginAttempt("1.2.3.4", false, NOW);
    expect(q.deletes.some((d) => d.m === "lt")).toBe(true);
  });
});
