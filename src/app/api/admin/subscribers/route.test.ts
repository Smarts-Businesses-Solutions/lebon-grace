import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The newsletter list is a list of people's email addresses, so the gate on it
 * matters more than the feature does.
 *
 * FOR-EVARISTE records the rule this endpoint has to obey: a new file under
 * `src/app/api/` is PUBLIC the moment it is created. That has already bitten
 * here once — `/api/variants?pid=` calls a paid API on our key with no auth and
 * no rate limit. So the first test is the 401, and it is written to fail if
 * anyone ever removes the guard.
 */
const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(() => false),
  getAll: vi.fn(async () => [] as Array<Record<string, unknown>>),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: m.requireAdmin }));
vi.mock("@/lib/store", () => ({ subscribers: { getAll: m.getAll } }));

import { GET } from "./route";

const req = (url = "https://shop.lebon-grace.com/api/admin/subscribers") => new NextRequest(url);

const LIST = [
  { id: "1", email: "a@example.com", source: "homepage", created_at: "2026-08-09T10:00:00Z" },
  { id: "2", email: "b@example.com", source: null, created_at: "2026-08-08T10:00:00Z" },
];

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAdmin.mockReturnValue(true);
  m.getAll.mockResolvedValue(LIST);
});

describe("GET /api/admin/subscribers", () => {
  it("401s without an admin session, and does not read the list", async () => {
    m.requireAdmin.mockReturnValue(false);
    const res = await GET(req());
    expect(res.status).toBe(401);
    // Not just the status: the addresses must not have been fetched at all.
    expect(m.getAll, "an unauthorised caller must not cause a read").not.toHaveBeenCalled();
  });

  it("returns the list and a count for an admin", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.subscribers).toHaveLength(2);
    expect(body.subscribers[0].email).toBe("a@example.com");
  });

  it("serves CSV on request, with a download filename", async () => {
    const res = await GET(req("https://shop.lebon-grace.com/api/admin/subscribers?format=csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="subscribers\.csv"/);
    const text = await res.text();
    expect(text.split("\n")[0]).toBe("email,source,subscribed_at");
    expect(text).toContain('"a@example.com"');
    // A null source becomes an empty quoted field rather than the word "null".
    expect(text).toContain('"b@example.com","",');
  });

  it("escapes a quote in a field rather than breaking the row", async () => {
    m.getAll.mockResolvedValue([
      { id: "3", email: 'we"ird@example.com', source: "a,b", created_at: "2026-08-09T10:00:00Z" },
    ]);
    const text = await GET(req("https://x/api/admin/subscribers?format=csv")).then((r) => r.text());
    expect(text).toContain('"we""ird@example.com"');
    // The comma inside the source stays inside its quoted field, so the row
    // still has exactly three fields.
    expect(text).toContain('"a,b"');
    expect(text.trim().split("\n")).toHaveLength(2);
  });

  it("csv is admin-only too", async () => {
    // The obvious way to leak this is to gate the JSON and forget the export.
    m.requireAdmin.mockReturnValue(false);
    const res = await GET(req("https://x/api/admin/subscribers?format=csv"));
    expect(res.status).toBe(401);
    expect(m.getAll).not.toHaveBeenCalled();
  });
});
