import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { checkLoginThrottle, recordLoginAttempt, throttledResponse } from "@/lib/login-throttle";
import {
  verifyPassword,
  verifyOperator,
  hasNamedOperators,
  makeSessionToken,
  requireAdmin,
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
} from "@/lib/admin-auth";

// GET → report whether the current request has a valid admin session.
// Used by the admin page on mount to restore the session without re-login.
export async function GET(request: NextRequest) {
  // `namedLogins` tells the login form whether to ask for an e-mail. Asking for
  // one before ADMIN_USERS is configured would present a field that cannot
  // succeed — the surest way to make someone believe they are locked out.
  return NextResponse.json({
    authenticated: requireAdmin(request),
    namedLogins: hasNamedOperators(),
  });
}

// POST → verify password, set the httpOnly signed session cookie.
export async function POST(request: NextRequest) {
  // Two layers, doing different jobs (A-21 / S-3).
  //
  // The in-memory limiter absorbs a burst without a database round trip, but
  // its buckets live in process memory and EVERY DEPLOY CLEARS THEM. With eight
  // deploys in a single day, an attacker never has to outlast the window — they
  // only have to still be running when someone ships.
  const limited = rateLimit(request, { key: "admin-login", limit: 5, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  // …so the durable count lives in Postgres and survives a restart. It counts
  // only failures, and a success wipes the address's history.
  const ip = clientIp(request);
  const throttle = await checkLoginThrottle(ip);
  if (throttle.blocked) return throttledResponse(throttle);

  const body = await request.json().catch(() => ({}));
  const password = String((body as { password?: unknown }).password || "");
  const email = String((body as { email?: unknown }).email || "");

  /*
   * Two ways in, and the order matters (AD-02).
   *
   * A named operator is tried first, so once ADMIN_USERS is configured the
   * session carries a name and every action it takes is attributable.
   *
   * The shared password remains as a fallback, deliberately. Removing it in the
   * same change that adds named logins means one typo in an env var locks the
   * operator out of the shop's admin with no way back in except a redeploy —
   * on a shop taking live payments, during whatever incident sent them to
   * /admin in the first place. It stops being a fallback the moment
   * ADMIN_PASSWORD is removed from the environment, which is a one-line change
   * to make deliberately, once named logins are proven working.
   */
  const actor = email ? verifyOperator(email, password) : null;
  const ok = actor !== null || verifyPassword(password);

  if (!ok) {
    await recordLoginAttempt(ip, false);
    // One message for both failure modes: a wrong e-mail and a wrong password
    // must be indistinguishable, or this endpoint tells a stranger which
    // addresses are operators.
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await recordLoginAttempt(ip, true);

  const res = NextResponse.json({ success: true, operator: actor || null });
  res.cookies.set(ADMIN_COOKIE, makeSessionToken(actor || undefined), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // HTTPS in prod (via tunnel); relaxed for local http
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  return res;
}

// DELETE → logout (clear the cookie).
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
