import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";
import { proxy } from "./proxy";
import { ADMIN_COOKIE } from "@/lib/admin-auth";

/**
 * The point of the middleware is a DEFAULT, so the tests are mostly about what
 * happens to things nobody thought about.
 *
 * There was no middleware at all, which meant a new file under `src/app/api/`
 * was public the moment it was created. `/api/variants` shipped that way — an
 * unauthenticated proxy onto a metered paid API (B-25) — and was documented as
 * the example of this hazard in two places while staying open for months.
 *
 * The first block below is the one that actually protects the property. The
 * middleware makes an unlisted route unreachable; this makes an unlisted route
 * **unmergeable**, which is better, because the author finds out rather than a
 * stranger.
 */

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const API_DIR = join(REPO_ROOT, "src", "app", "api");

/** Every `/api/...` path that actually exists on disk. */
function routesOnDisk(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name === "route.ts" || entry.name === "route.tsx") {
        const rel = relative(API_DIR, dir).split(sep).filter(Boolean).join("/");
        found.push(`/api${rel ? "/" + rel : ""}`);
      }
    }
  };
  walk(API_DIR);
  return found.sort();
}

/** The two lists, read from the source so the test cannot drift from them. */
function declaredRoutes(): { pub: string[]; admin: string[] } {
  const src = readFileSync(join(REPO_ROOT, "src", "proxy.ts"), "utf8");
  const grab = (name: string) => {
    const start = src.indexOf(`const ${name} = new Set([`);
    const end = src.indexOf("]);", start);
    return [...src.slice(start, end).matchAll(/"(\/api\/[^"]*)"/g)].map((m) => m[1]).sort();
  };
  return { pub: grab("PUBLIC_API"), admin: grab("ADMIN_API") };
}

const req = (path: string, opts: { admin?: boolean; method?: string } = {}) => {
  const r = new NextRequest(`https://shop.lebon-grace.com${path}`, { method: opts.method ?? "GET" });
  if (opts.admin) r.cookies.set(ADMIN_COOKIE, "some-signed-token");
  return r;
};
/** NextResponse.next() marks the response with this header. */
const passedThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("every API route is accounted for", () => {
  it("no route exists on disk without being listed", () => {
    const { pub, admin } = declaredRoutes();
    const declared = new Set([...pub, ...admin]);
    const onDisk = routesOnDisk();

    // Precondition: we are actually reading routes. A walk that found nothing
    // would report "all accounted for" just as cheerfully (L-2).
    expect(onDisk.length, "expected to find API routes on disk").toBeGreaterThan(5);

    const missing = onDisk.filter((r) => !declared.has(r));
    expect(
      missing,
      `These API routes exist but are not listed in src/proxy.ts, so they answer 404.\n` +
        `Add each to PUBLIC_API or ADMIN_API — whichever you actually meant:\n  ${missing.join("\n  ")}`
    ).toEqual([]);
  });

  it("no listed route is stale", () => {
    const { pub, admin } = declaredRoutes();
    const onDisk = new Set(routesOnDisk());
    const stale = [...pub, ...admin].filter((r) => !onDisk.has(r));
    expect(stale, `listed in middleware but no longer on disk: ${stale.join(", ")}`).toEqual([]);
  });

  it("a route is in exactly one list, never both", () => {
    const { pub, admin } = declaredRoutes();
    const both = pub.filter((r) => admin.includes(r));
    expect(both).toEqual([]);
  });
});

describe("the traps that would take the shop down", () => {
  it("/api/admin/login is PUBLIC — it is how you get a session", () => {
    // A prefix rule ("everything under /api/admin needs a session") locks
    // everyone out permanently. This is why the lists are explicit paths.
    expect(passedThrough(proxy(req("/api/admin/login", { method: "POST" })))).toBe(true);
  });

  it("/api/stripe-webhook is PUBLIC — Stripe authenticates by signature, not cookie", () => {
    // A cookie check here breaks payments outright: no order is ever created.
    expect(passedThrough(proxy(req("/api/stripe-webhook", { method: "POST" })))).toBe(true);
  });

  it("the customer-facing money path is untouched", () => {
    for (const p of ["/api/checkout", "/api/orders", "/api/products", "/api/reviews"]) {
      expect(passedThrough(proxy(req(p))), `${p} must stay reachable`).toBe(true);
    }
  });

  it("pages are not matched at all", () => {
    // The matcher is /api/:path*, so a mistake here cannot take the shop down.
    expect(existsSync(join(REPO_ROOT, "src", "proxy.ts"))).toBe(true);
    const src = readFileSync(join(REPO_ROOT, "src", "proxy.ts"), "utf8");
    expect(src).toMatch(/matcher:\s*"\/api\/:path\*"/);
  });
});

describe("the default", () => {
  it("an unregistered API route answers 404, not 200", () => {
    // The whole feature in one assertion: a route nobody listed is unreachable.
    const res = proxy(req("/api/some-new-thing-nobody-listed"));
    expect(res.status).toBe(404);
    expect(passedThrough(res)).toBe(false);
  });

  it("404 rather than 401, so a probe cannot map the API", () => {
    const res = proxy(req("/api/internal/secret-debug-endpoint"));
    expect(res.status).toBe(404);
  });

  it("an admin route without a session is refused", async () => {
    const res = proxy(req("/api/metrics"));
    expect(res.status).toBe(401);
    expect(passedThrough(res)).toBe(false);
  });

  it("an admin route WITH a session is passed to the handler that really checks it", () => {
    // Presence only — the cookie value here is nonsense. requireAdmin() verifies
    // the signature; this proves middleware defers rather than duplicating it.
    expect(passedThrough(proxy(req("/api/metrics", { admin: true })))).toBe(true);
  });

  it("a trailing slash cannot slip past the lookup", () => {
    expect(passedThrough(proxy(req("/api/checkout/", { method: "POST" })))).toBe(true);
    expect(proxy(req("/api/metrics/")).status).toBe(401);
  });
});
