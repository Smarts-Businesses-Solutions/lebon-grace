/**
 * Server-side admin authentication.
 *
 * Replaces the old client-side password compare (which shipped the password in
 * the JS bundle and gated nothing on the server). Flow:
 *   1. POST /api/admin/login with the password → verified against ADMIN_PASSWORD
 *      (server env, never NEXT_PUBLIC) → sets an httpOnly, signed session cookie.
 *   2. Admin API routes call requireAdmin(request) and 401 if the cookie is
 *      missing, tampered, or expired.
 *
 * The session token is a stateless HMAC: `admin.<expiry_ms>.<hex_sig>`. No DB
 * row needed — validity is the signature + expiry. Rotating ADMIN_SESSION_SECRET
 * invalidates every issued session.
 */
import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "lg_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours (seconds)

const SECRET = process.env.ADMIN_SESSION_SECRET || "";
const PASSWORD = process.env.ADMIN_PASSWORD || "";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

/** Constant-time string equality that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** True only if the submitted password matches ADMIN_PASSWORD. */
export function verifyPassword(input: string): boolean {
  if (!PASSWORD || !SECRET) return false; // misconfigured → deny, never allow
  return safeEqual(input, PASSWORD);
}

/** Mint a fresh signed session token valid for ADMIN_COOKIE_MAX_AGE. */
export function makeSessionToken(): string {
  const exp = Date.now() + ADMIN_COOKIE_MAX_AGE * 1000;
  const payload = `admin.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Validate a session token's signature and expiry. */
export function isValidSessionToken(token: string | undefined | null): boolean {
  if (!token || !SECRET) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [role, expStr, sig] = parts;
  if (!safeEqual(sig, sign(`${role}.${expStr}`))) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return role === "admin";
}

/** Gate for admin API routes — reads the httpOnly cookie off the request. */
export function requireAdmin(request: NextRequest): boolean {
  return isValidSessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
}
