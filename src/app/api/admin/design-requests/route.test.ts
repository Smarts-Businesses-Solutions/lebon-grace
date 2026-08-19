import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The design queue and the artwork viewer are the most sensitive endpoints in
 * the shop: names, emails, phone numbers, and a way to fetch a photograph a
 * customer sent, often of a child.
 *
 * So these tests assert the boundary itself, not the happy path. An admin route
 * that forgets its guard still returns correct-looking data, which is precisely
 * why it needs a test that fails when the guard goes.
 */

const admin = { ok: false };
const deleted = vi.fn();
const cleared = vi.fn();
const statused = vi.fn();

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: () => admin.ok }));

const row = {
  id: "row-1",
  reference: "LG-ABC234",
  artwork_key: "pending/LG-ABC234/x.jpg",
  artwork_type: "image/jpeg",
  customer_name: "Amira",
  customer_email: "a@example.test",
  customer_phone: null,
  brief: "a boat board",
  status: "submitted",
  artwork_bytes: 100,
  operator_note: null,
  created_at: "2026-08-19T00:00:00Z",
} as Record<string, unknown>;

vi.mock("@/lib/design-requests", () => ({
  listOpenRequests: async () => [row],
  getByReference: async (r: string) => (r === "LG-ABC234" ? row : null),
  setStatus: async (...a: unknown[]) => void statused(...a),
  clearArtwork: async (...a: unknown[]) => void cleared(...a),
}));

vi.mock("@/lib/artwork-storage", () => ({
  deleteArtwork: async (...a: unknown[]) => void deleted(...a),
  signedArtworkUrl: async () => "https://r2.example.test/signed?X-Amz-Expires=60",
}));

const { GET, PATCH } = await import("./route");
const { GET: ARTWORK_GET } = await import("./artwork/route");

const req = (url = "https://shop.test/api/admin/design-requests") =>
  ({ nextUrl: new URL(url), json: async () => ({}) }) as never;

const patchReq = (body: unknown) =>
  ({ nextUrl: new URL("https://shop.test/x"), json: async () => body }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  admin.ok = false;
  row.artwork_key = "pending/LG-ABC234/x.jpg";
});

describe("the admin boundary", () => {
  it("refuses the queue without a session", async () => {
    expect((await GET(req())).status).toBe(401);
  });

  it("refuses a status change without a session", async () => {
    const res = await PATCH(patchReq({ reference: "LG-ABC234", status: "approved" }));
    expect(res.status).toBe(401);
    expect(statused).not.toHaveBeenCalled();
  });

  it("refuses to mint a signed URL without a session", async () => {
    const res = await ARTWORK_GET(req("https://shop.test/x?reference=LG-ABC234"));
    expect(res.status).toBe(401);
  });
});

describe("the queue listing", () => {
  beforeEach(() => { admin.ok = true; });

  it("never returns the object key, only whether artwork exists", async () => {
    /*
     * The key is an internal detail. Returning it would let a caller ask the
     * viewer for an arbitrary path in the bucket instead of a row they are
     * entitled to.
     */
    const body = await (await GET(req())).json();
    const serialised = JSON.stringify(body);

    expect(body.requests[0].hasArtwork).toBe(true);
    expect(serialised).not.toContain("pending/");
    expect(serialised).not.toContain("artwork_key");
  });

  it("is never cached, because it is a list of customer contact details", async () => {
    const res = await GET(req());
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});

describe("declining a request", () => {
  beforeEach(() => { admin.ok = true; });

  it("deletes the photograph immediately rather than waiting for the sweep", async () => {
    const res = await PATCH(patchReq({ reference: "LG-ABC234", status: "declined" }));
    const body = await res.json();

    expect(body.artworkDeleted).toBe(true);
    expect(deleted).toHaveBeenCalledWith("pending/LG-ABC234/x.jpg");
    expect(cleared).toHaveBeenCalled();
  });

  it("deletes from storage BEFORE clearing the row", async () => {
    // The other order leaves an orphan in R2 that nothing knows about, which is
    // how a private bucket quietly accumulates photographs nobody can account
    // for. If the delete fails, the row still points at a real object and the
    // sweep retries.
    const order: string[] = [];
    deleted.mockImplementation(() => void order.push("storage"));
    cleared.mockImplementation(() => void order.push("row"));

    await PATCH(patchReq({ reference: "LG-ABC234", status: "declined" }));
    expect(order).toEqual(["storage", "row"]);
  });

  it("refuses statuses the operator must not set by hand", async () => {
    // "ordered" belongs to the order path, "expired" to the sweep, "submitted"
    // is where a row starts. Hand-writing those makes status mean whatever was
    // last clicked.
    for (const status of ["ordered", "expired", "submitted"]) {
      const res = await PATCH(patchReq({ reference: "LG-ABC234", status }));
      expect(res.status).toBe(400);
    }
    expect(statused).not.toHaveBeenCalled();
  });
});

describe("the artwork viewer", () => {
  beforeEach(() => { admin.ok = true; });

  it("takes a reference and looks the key up itself", async () => {
    const res = await ARTWORK_GET(req("https://shop.test/x?reference=LG-ABC234"));
    const body = await res.json();
    expect(body.url).toContain("X-Amz-Expires=60");
    expect(body.expiresInSeconds).toBe(60);
  });

  it("does not cache the response, because the body is the credential", async () => {
    const res = await ARTWORK_GET(req("https://shop.test/x?reference=LG-ABC234"));
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("404s for a request whose artwork is already gone", async () => {
    row.artwork_key = null;
    const res = await ARTWORK_GET(req("https://shop.test/x?reference=LG-ABC234"));
    expect(res.status).toBe(404);
  });

  it("404s for an unknown reference rather than signing anything", async () => {
    const res = await ARTWORK_GET(req("https://shop.test/x?reference=LG-NOPE99"));
    expect(res.status).toBe(404);
  });
});
