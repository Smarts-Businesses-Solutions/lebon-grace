import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { checkLoginThrottle, recordLoginAttempt, throttledResponse } from "@/lib/login-throttle";
import {
  verifyPassword,
  makeSessionToken,
  requireAdmin,
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
} from "@/lib/admin-auth";

// GET → report whether the current request has a valid admin session.
// Used by the admin page on mount to restore the session without re-login.
export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: requireAdmin(request) });
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

  if (!verifyPassword(password)) {
    await recordLoginAttempt(ip, false);
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  await recordLoginAttempt(ip, true);

  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, makeSessionToken(), {
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
