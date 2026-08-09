import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { clientIp } from "./rate-limit";

/**
 * Which IP the rate limiter buckets on.
 *
 * Found walking production 2026-08-09. `clientIp` read
 * `xff.split(",")[0]` — the LEFTMOST entry of X-Forwarded-For, which is the
 * value the *client* supplied. Every proxy appends on the right, so the
 * leftmost is the one entry an attacker fully controls: a random header per
 * request would have meant a fresh bucket per request, and all nine public
 * limiters — order lookup, contact-reveal, reviews, checkout — would have been
 * bypassable with one header.
 *
 * It was NOT exploitable, and that is the interesting part. Tested against
 * production and again straight at the origin: three distinct spoofed values
 * all landed in the same already-tripped bucket, because Traefik overwrites
 * X-Forwarded-For with the real connecting address before the app sees it.
 *
 * So the code was wrong and the deployment saved it. The file's own comment
 * credited a different mitigation — "the container binds to loopback and is
 * only reachable through the tunnel" — which describes the decommissioned
 * Caddy/SSH-tunnel setup, not today's Coolify/Traefik. Correct behaviour was
 * resting on an undocumented property of a proxy nobody had written down, and
 * a Traefik `forwardedHeaders.trustedIPs` change would have silently removed
 * it.
 *
 * These tests pin the ordering so the guarantee lives in the app, where it can
 * be seen, rather than in a proxy config it does not own.
 */

function req(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe("clientIp", () => {
  it("prefers CF-Connecting-IP, which Cloudflare sets and strips from clients", () => {
    expect(
      clientIp(
        req({
          "cf-connecting-ip": "203.0.113.5",
          "x-forwarded-for": "1.2.3.4, 203.0.113.5",
          "x-real-ip": "9.9.9.9",
        })
      )
    ).toBe("203.0.113.5");
  });

  it("ignores a spoofed leftmost X-Forwarded-For entry", () => {
    // The attack: attacker sends a fake first hop, proxy appends the real IP.
    // Bucketing on the fake value gives a fresh allowance every request.
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 198.51.100.20" }))).toBe(
      "198.51.100.20"
    );
  });

  it("takes the rightmost entry for a longer proxy chain", () => {
    expect(
      clientIp(req({ "x-forwarded-for": "6.6.6.6, 10.0.0.1, 198.51.100.30" }))
    ).toBe("198.51.100.30");
  });

  it("falls back to x-real-ip when there is no forwarded chain", () => {
    expect(clientIp(req({ "x-real-ip": "198.51.100.40" }))).toBe("198.51.100.40");
  });

  it("does not return a client-supplied value as the bucket when nothing is trustworthy", () => {
    // No proxy headers at all: everyone shares the "unknown" bucket. That is
    // deliberately conservative — sharing one bucket rate-limits too much,
    // never too little.
    expect(clientIp(req({}))).toBe("unknown");
  });

  it("rejects a garbage forwarded value rather than bucketing on it", () => {
    expect(clientIp(req({ "x-forwarded-for": "not-an-ip" }))).toBe("unknown");
  });
});
