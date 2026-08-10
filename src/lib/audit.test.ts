import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The audit trail must never be able to break the thing it is auditing.
 *
 * The operator's action has already succeeded by the time this runs. Failing to
 * record it must not turn a completed status change into an error page, and must
 * not delay the response — but it must also not vanish, or a silent audit log
 * would pretend to be a working one, which is B-29's whole shape.
 */

const m = vi.hoisted(() => ({
  record: vi.fn(
    async (
      _a: string,
      _t: string,
      _i: string,
      _d?: Record<string, unknown>,
      _actor?: string | null
    ) => true
  ),
}));
vi.mock("./store", () => ({ adminActions: { record: m.record } }));

import { recordAdminAction } from "./audit";

beforeEach(() => vi.clearAllMocks());

describe("recordAdminAction", () => {
  it("passes the action through to the store", () => {
    recordAdminAction(
      "order.status_changed",
      "order",
      "ord_1",
      { from: "processing", to: "refunded" },
      "wanresionne@gmail.com"
    );
    expect(m.record).toHaveBeenCalledWith(
      "order.status_changed",
      "order",
      "ord_1",
      { from: "processing", to: "refunded" },
      "wanresionne@gmail.com"
    );
  });

  it("passes an unattributed session through as-is, rather than inventing a name", () => {
    // "" is a real session with no name: a cookie minted before named logins
    // existed, or one using the shared fallback password. The store turns it
    // into NULL. What must not happen is this layer substituting a plausible
    // operator, which is precisely why migration 0007 shipped with no actor
    // column at all (AD-02).
    recordAdminAction("order.status_changed", "order", "ord_1", {}, "");
    expect(m.record).toHaveBeenCalledWith("order.status_changed", "order", "ord_1", {}, "");
  });

  it("returns immediately — the caller never waits on it", () => {
    // A never-settling record must not block. If this ever starts awaiting, a
    // slow database would add its latency to every admin action.
    m.record.mockImplementation(() => new Promise<boolean>(() => {}));
    expect(() => recordAdminAction("order.status_changed", "order", "ord_1")).not.toThrow();
  });

  it("survives a store that rejects, without an unhandled rejection", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    m.record.mockRejectedValueOnce(new Error("database is on fire"));

    expect(() => recordAdminAction("order.status_changed", "order", "ord_1")).not.toThrow();
    // Let the rejection settle; an unhandled one would surface here.
    await new Promise((r) => setTimeout(r, 0));

    expect(err.mock.calls.flat().map(String).join(" ")).toContain("could not record");
    err.mockRestore();
  });

  it("PRECONDITION: a healthy record logs nothing", async () => {
    // Without this, a function that always logged an error would satisfy the
    // assertion above while making the log useless.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    recordAdminAction("order.status_changed", "order", "ord_1");
    await new Promise((r) => setTimeout(r, 0));
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });
});
