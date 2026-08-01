import { NextRequest, NextResponse } from "next/server";
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
  const body = await request.json().catch(() => ({}));
  const password = String((body as { password?: unknown }).password || "");

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

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
