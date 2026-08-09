import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ORDER_STATUSES, STATUS_PRESENTATION, isOrderStatus } from "./order-status";

/**
 * The status set is declared in four places and had drifted in three.
 *
 * Found walking production as an order tracker. `STATUS_INDEX` in
 * `TrackClient` mapped six statuses; the database CHECK accepts ten. The other
 * four fell to `?? -1`, which draws a 0% progress bar with no step lit — so an
 * operator setting "refunded" left the customer looking at what reads as an
 * order about to start, in the same blue used for "in progress".
 *
 * These tests pin the set against the migration that creates the constraint, so
 * the next status added to one place fails here rather than in front of a
 * customer.
 */
describe("order status set", () => {
  it("matches the CHECK constraint in migration 0002", () => {
    // Read from the migration rather than a live database: this must run in CI
    // with no credentials, and the migration IS the definition of production.
    const sql = readFileSync(
      new URL("../../supabase/migrations/0002_add_constraints.sql", import.meta.url),
      "utf8"
    );
    // Parse the CHECK body only. Matching quoted words across the whole file
    // would also pick up the commentary above it, which discusses removing
    // 'paid' — the first draft used /'([a-z_]+)'::text/ (how Postgres RENDERS
    // the constraint, not how the migration WRITES it) and matched nothing.
    // Anchor on the ALTER TABLE statement, not the first mention of the
    // constraint name: the commentary above it shows a WORKED EXAMPLE of the
    // same constraint without "paid", so anchoring on the name parsed the
    // example and matched exactly one value. Third parse attempt; the
    // precondition caught all three.
    const check = sql.slice(sql.indexOf("ADD CONSTRAINT orders_status_valid CHECK"));
    // The constraint block closes with a bracket, newline, bracket, semicolon,
    // so there is no literal double-bracket to slice to. The second draft
    // looked for one, got -1, and parsed almost nothing. The precondition
    // below is what caught that, and the attempt before it.
    const body = check.slice(check.indexOf("status IN ("), check.indexOf(");"));
    const inDb = [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    const statusValues = ORDER_STATUSES.filter((s) => inDb.includes(s));

    // Precondition: the migration really does list statuses, so a parse failure
    // cannot masquerade as agreement.
    expect(inDb.length, "migration 0002 should declare the status values").toBeGreaterThan(5);

    for (const s of ORDER_STATUSES) {
      expect(inDb, `"${s}" is in the TypeScript set but not in the CHECK constraint`).toContain(s);
    }
    expect(statusValues.length).toBe(ORDER_STATUSES.length);
  });

  it("gives every status a presentation — none may fall through", () => {
    // The bug in one line: a status with no entry rendered as step -1.
    for (const s of ORDER_STATUSES) {
      expect(STATUS_PRESENTATION[s], `"${s}" has no presentation`).toBeDefined();
    }
    expect(Object.keys(STATUS_PRESENTATION).sort()).toEqual([...ORDER_STATUSES].sort());
  });

  it("puts terminal states OFF the pipeline, with copy", () => {
    // A refund drawn as a pipeline at 0% is what made this a customer-facing
    // problem rather than a cosmetic one.
    for (const s of ["refunded", "cancelled", "failed"] as const) {
      expect(STATUS_PRESENTATION[s].step, `${s} must not sit on the pipeline`).toBeNull();
      expect(STATUS_PRESENTATION[s].terminalTitle, `${s} needs a headline`).toBeTruthy();
      expect(STATUS_PRESENTATION[s].terminalBody, `${s} needs an explanation`).toBeTruthy();
    }
  });

  it("does not colour a refund like a failure, nor like progress", () => {
    // The money went back: that is a completed outcome, not an error, and not
    // an order on its way.
    expect(STATUS_PRESENTATION.refunded.tone).toBe("neutral");
    expect(STATUS_PRESENTATION.failed.tone).toBe("negative");
    expect(STATUS_PRESENTATION.cancelled.tone).toBe("negative");
    expect(STATUS_PRESENTATION.deposit_paid.tone).toBe("progress");
    expect(STATUS_PRESENTATION.delivered.tone).toBe("done");
  });

  it("keeps every pipeline step within the five stages", () => {
    for (const s of ORDER_STATUSES) {
      const step = STATUS_PRESENTATION[s].step;
      if (step !== null) {
        expect(step, `${s} step out of range`).toBeGreaterThanOrEqual(0);
        expect(step, `${s} step out of range`).toBeLessThanOrEqual(4);
      }
    }
  });

  it("recognises its own values and rejects anything else", () => {
    expect(isOrderStatus("refunded")).toBe(true);
    expect(isOrderStatus("paid")).toBe(true);
    expect(isOrderStatus("not_a_status")).toBe(false);
    expect(isOrderStatus(undefined)).toBe(false);
  });
});
