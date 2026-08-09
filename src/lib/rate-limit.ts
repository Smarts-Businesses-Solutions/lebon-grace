/**
 * In-memory rate limiter (fixed window per key).
 *
 * Deliberately dependency-free and in-process: this app runs as a single
 * container, so a shared store (Redis) would add an unnecessary moving part.
 * If it is ever scaled to multiple replicas, swap the Map for Redis — the
 * public API below stays the same.
 *
 * Keyed by client IP -- see clientIp() below for which header is trusted and
 * why the order matters.
 *
 * NOTE ON PERSISTENCE. This Map is zeroed by every restart and deploy, so all
 * nine public limiters reset together. That is the same weakness B-12 found in
 * the admin login throttle, which is why THAT one moved to the database
 * (login_attempts). It is left in memory here deliberately: measured against
 * the order-lookup credential it protects, the reset buys an attacker very
 * little -- the phone space is ~10^7 real UAE numbers, so even a few resets a
 * day leave a brute-force run in the order of years. The credential, not the
 * window, is the limiting factor. Revisit if the credential is ever
 * strengthened, or if this app runs more than one replica.
 */
import type { NextRequest } from "next/server";

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

// Bound memory: drop expired entries whenever the map grows past this.
const MAX_KEYS = 10_000;

function sweep(now: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

/** Loose shape check. Enough to reject junk; not a validator. */
const IPISH = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+:[0-9a-f:]*$/i;

/**
 * The address a limiter buckets on.
 *
 * Order matters, most trustworthy first:
 *
 *  1. `cf-connecting-ip` — Cloudflare sets this and strips any client-supplied
 *     copy, so it cannot be forged from outside.
 *  2. `x-real-ip` — set by the Traefik hop in front of the container.
 *  3. the RIGHTMOST entry of `x-forwarded-for`.
 *
 * Rightmost, not leftmost. Every proxy APPENDS, so the leftmost entry is the
 * one value an attacker fully controls; bucketing on it hands out a fresh
 * allowance for every request, and with it the order-lookup, contact-reveal
 * and review limiters. This previously read `xff.split(",")[0]`.
 *
 * That was never exploitable here, and the reason is worth writing down:
 * Traefik overwrites `x-forwarded-for` with the real connecting address before
 * the app sees it. Verified 2026-08-09 against production and again straight at
 * the origin — three distinct spoofed values all landed in the same bucket.
 *
 * The comment this replaces credited a different mitigation, "the container
 * binds to loopback and is only reachable through the tunnel", which described
 * the Caddy/SSH-tunnel deployment that no longer exists. The guarantee lived in
 * a proxy setting this app does not own and nobody had recorded, so a
 * `forwardedHeaders.trustedIPs` change would have removed it silently. Now the
 * app does not depend on it.
 *
 * Anything unrecognised collapses to "unknown", a single shared bucket. That
 * over-limits rather than under-limits, which is the safe direction to fail.
 */
export function clientIp(request: NextRequest): string {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf && IPISH.test(cf)) return cf;

  const real = request.headers.get("x-real-ip")?.trim();
  if (real && IPISH.test(real)) return real;

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((h) => h.trim()).filter(Boolean);
    for (let i = hops.length - 1; i >= 0; i--) {
      if (IPISH.test(hops[i])) return hops[i];
    }
  }
  return "unknown";
}

/**
 * Returns null when the request is allowed, or a 429 Response when it is not.
 *
 *   const limited = rateLimit(request, { key: "login", limit: 5, windowMs: 60_000 });
 *   if (limited) return limited;
 */
export function rateLimit(
  request: NextRequest,
  opts: { key: string; limit: number; windowMs: number }
): Response | null {
  const now = Date.now();
  sweep(now);

  const id = `${opts.key}:${clientIp(request)}`;
  const hit = buckets.get(id);

  if (!hit || hit.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + opts.windowMs });
    return null;
  }

  hit.count++;
  if (hit.count > opts.limit) {
    const retryAfter = Math.ceil((hit.resetAt - now) / 1000);
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(opts.limit),
        "X-RateLimit-Remaining": "0",
      },
    });
  }
  return null;
}
