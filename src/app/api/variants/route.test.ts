import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * `/api/variants` must never make an outbound call on our behalf.
 *
 * Written from a defect found walking production as the operator. The route had
 * a `?pid=` branch that POSTed to the CJ Dropshipping API using `CJDS_API_KEY`,
 * with **no authentication and no rate limit**. Anyone on the internet could
 * make this shop issue billable, authenticated requests to a paid third-party
 * API, in a loop.
 *
 * Verified live before the fix:
 *
 *     GET /api/variants?pid=DOESNOTEXIST123
 *     -> 200 {"source":"cj","variants":[],"images":[],"error":"CJ API unavailable"}
 *
 * — the `source:"cj"` proving the outbound call had been attempted, and the key
 * is set in production.
 *
 * FOR-EVARISTE has recorded this exact endpoint as the example of "a new file
 * under src/app/api/ is public on creation" for some time. It stayed open
 * because it was documented rather than fixed.
 *
 * It was also serving nothing: `cjPid` appears in the generated catalogue only
 * as an optional type field, so no product carries one and no visitor ever
 * reached this branch. The dropship model it belonged to was abandoned — A-10
 * archived its scripts. So the branch is removed rather than gated: a gate on
 * dead code is a thing to maintain, and L-8 says fix the layer that makes the
 * failure impossible.
 *
 * `cjPid` itself stays. MDF products use it as a LOCAL marker
 * (`product.cjPid?.startsWith("MDF")`), which never leaves the process.
 */
vi.mock("@/lib/store", () => ({ productVariants: { getBySlug: vi.fn(async () => []) } }));
vi.mock("@/lib/variants", () => ({ getVariantGroup: vi.fn(() => null) }));
// getProductBySlug as well as products: the route resolves by slug so that an
// unlisted product still works. An empty catalogue is right for this suite —
// it asserts no outbound request is made — but the export must exist.
vi.mock("@/lib/products", () => ({ products: [], getProductBySlug: () => undefined }));

import { GET } from "./route";

const req = (qs: string) => new NextRequest(`https://shop.lebon-grace.com/api/variants?${qs}`);

beforeEach(() => {
  // The key IS set, deliberately: the test must prove the branch is gone, not
  // that it silently no-ops because no credential is present.
  process.env.CJDS_API_KEY = "test-key-should-never-be-used";
  vi.spyOn(globalThis, "fetch");
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CJDS_API_KEY;
});

/** The spy installed above, typed for assertion. */
const outbound = () => vi.mocked(globalThis.fetch);

describe("GET /api/variants", () => {
  it("makes NO outbound request when given ?pid=, even with the key set", async () => {
    const res = await GET(req("pid=ANYTHING"));
    expect(res.status).toBe(200);
    // The assertion that matters: our key is never spent for an anonymous caller.
    expect(outbound(), "the CJ passthrough must be gone, not merely unused").not.toHaveBeenCalled();
  });

  it("no longer reports a cj source", async () => {
    const body = await GET(req("pid=ANYTHING")).then((r) => r.json());
    expect(body.source).not.toBe("cj");
    expect(body).toEqual({ source: "none", variants: [], images: [] });
  });

  it("makes no outbound request for a slug lookup either", async () => {
    const res = await GET(req("slug=abc-jigsaw-board"));
    expect(res.status).toBe(200);
    expect(outbound()).not.toHaveBeenCalled();
  });

  it("still answers a bare request without throwing", async () => {
    // Precondition for the absence assertions above: the route runs at all.
    const body = await GET(req("")).then((r) => r.json());
    expect(body).toEqual({ source: "none", variants: [], images: [] });
  });
});
