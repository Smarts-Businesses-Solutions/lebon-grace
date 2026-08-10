import { test, expect } from "@playwright/test";

/**
 * Baseline browser security headers (SH-05).
 *
 * Production served **none** — not `X-Content-Type-Options`, not a referrer
 * policy, nothing. On a shop that takes card details through a redirect and
 * holds customer addresses behind an admin login, these cost nothing and remove
 * whole classes of attack: MIME sniffing, referrer leakage of order URLs to
 * third parties, clickjacking of `/admin`, and `<base>` injection.
 *
 * Asserted against a real response rather than the config, because the config
 * is what we wrote and the header is what the customer's browser receives —
 * Caddy sits in front, and a rewrite could drop them without anyone noticing.
 *
 * **Deliberately NOT asserted: a nonce-based `script-src`.** Next generates
 * nonces in the proxy, and reading one forces DYNAMIC rendering on every page
 * that uses it. This shop is almost entirely prerendered — the live homepage
 * comes back `X-Nextjs-Prerender: 1` from cache — so a nonce CSP would trade the
 * thing that makes the shop fast for a directive that mainly guards against
 * inline-script injection we have no known vector for. The other CSP
 * directives, which need no nonce, are asserted below.
 */
test.describe("@seo baseline security headers", () => {
  const REQUIRED: Array<[string, RegExp]> = [
    ["x-content-type-options", /nosniff/i],
    ["referrer-policy", /strict-origin-when-cross-origin/i],
    ["x-frame-options", /DENY|SAMEORIGIN/i],
    ["permissions-policy", /camera=\(\)/i],
  ];

  for (const [header, expected] of REQUIRED) {
    test(`sends ${header}`, async ({ request }) => {
      const res = await request.get("/");
      // Precondition (L-2): the page actually served. Without it, "the header is
      // missing" would also pass against a dead server.
      expect(res.status(), "precondition: the homepage must respond 200").toBe(200);

      const value = res.headers()[header];
      expect(value, `${header} must be present`).toBeTruthy();
      expect(value).toMatch(expected);
    });
  }

  test("sends a CSP that locks down the directives a static site can lock down", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);

    const csp = res.headers()["content-security-policy"];
    expect(csp, "a content security policy must be present").toBeTruthy();

    // The ones that need no nonce and cost no rendering strategy.
    expect(csp, "framing is what clickjacks /admin").toContain("frame-ancestors 'none'");
    expect(csp, "<base> injection rewrites every relative URL on the page").toContain("base-uri 'self'");
    expect(csp, "a form must not be able to post the cart elsewhere").toContain("form-action 'self'");
    expect(csp, "no plugins, ever").toContain("object-src 'none'");

    // The image and connect allowlists must still permit what the shop uses, or
    // this header is a broken shop rather than a secure one.
    expect(csp, "product images come from the catalogue host").toContain("cbu01.alicdn.com");
    expect(csp, "error reporting must still reach GlitchTip").toContain("glitchtip.axiomsynapse.com");
  });
});
