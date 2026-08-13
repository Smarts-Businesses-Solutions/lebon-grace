import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A signed, self-contained unsubscribe link.
 *
 * RFC 8058 one-click unsubscribe is a POST from the MAIL CLIENT, not the
 * person: Gmail sends `List-Unsubscribe=One-Click` with no session, no cookie
 * and no JSON body. So the address has to travel in the URL, and it has to be
 * signed — an unsigned `?email=` would let anyone unsubscribe anyone by editing
 * the query string.
 *
 * HMAC over the lowercased address, no expiry. An unsubscribe link in a
 * two-year-old e-mail should still work: expiring it means a recipient who
 * cannot unsubscribe presses "report spam" instead, which is the outcome the
 * whole mechanism exists to avoid.
 */
function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || "";
}

export function makeUnsubscribeToken(email: string): string {
  const addr = String(email || "").trim().toLowerCase();
  if (!addr || !secret()) return "";
  const sig = createHmac("sha256", secret()).update(addr).digest("hex").slice(0, 32);
  return `${Buffer.from(addr).toString("base64url")}.${sig}`;
}

/** The address a token belongs to, or null if it is not genuine. */
export function readUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token || !secret()) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;

  let addr: string;
  try {
    addr = Buffer.from(token.slice(0, i), "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!addr) return null;

  const expected = createHmac("sha256", secret()).update(addr).digest("hex").slice(0, 32);
  const got = token.slice(i + 1);
  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false, and a thrown error here would 500 an unsubscribe.
  if (got.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(got), Buffer.from(expected))) return null;
  return addr;
}
