/**
 * Canonical public URL of the storefront.
 *
 * Resolution order:
 *   1. APP_URL              — server-only, read at RUNTIME (preferred)
 *   2. NEXT_PUBLIC_APP_URL  — legacy; inlined at BUILD time
 *   3. the production default
 *
 * Why APP_URL rather than NEXT_PUBLIC_APP_URL: everything that needs this value
 * (Stripe success_url/cancel_url, sitemap, robots, email links) runs on the
 * server. `NEXT_PUBLIC_*` is inlined into the bundle at build time, so changing
 * it requires a full rebuild — and if it is ever wrong, paying customers get
 * redirected to a URL that does not exist. A plain env var is read from the
 * container environment on every request, so the domain can change with a
 * restart instead of a rebuild.
 *
 * Deliberately NOT derived from request headers (Host / X-Forwarded-Host):
 * those are attacker-controlled, and a spoofed host in a Stripe redirect would
 * send a customer somewhere else after payment.
 */
const DEFAULT_URL = "https://shop.lebon-grace.com";

function normalize(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  // A localhost value in production means the env was not configured for the
  // deployment; fall through rather than redirect customers to their own machine.
  if (process.env.NODE_ENV === "production" && /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(trimmed)) {
    return null;
  }
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

export function getAppUrl(): string {
  return (
    normalize(process.env.APP_URL) ||
    normalize(process.env.NEXT_PUBLIC_APP_URL) ||
    DEFAULT_URL
  );
}
