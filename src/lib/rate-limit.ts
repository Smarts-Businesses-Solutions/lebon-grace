/**
 * In-memory rate limiter (fixed window per key).
 *
 * Deliberately dependency-free and in-process: this app runs as a single
 * container, so a shared store (Redis) would add an unnecessary moving part.
 * If it is ever scaled to multiple replicas, swap the Map for Redis — the
 * public API below stays the same.
 *
 * Keyed by client IP, read from the proxy headers set by Caddy/Cloudflare in
 * front of the app. X-Forwarded-For can be spoofed when the app is reached
 * directly, which is why the container binds to loopback and is only reachable
 * through the tunnel.
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

export function clientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
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
