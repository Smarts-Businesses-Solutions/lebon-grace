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
import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "crypto";
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

/*
 * ── Named operators (AD-02) ───────────────────────────────────────────────────
 *
 * One shared password means the audit trail can say WHAT changed and WHEN, never
 * WHO. With two people using /admin that is a real gap: "who cancelled this
 * order" has no answer.
 *
 * Credentials live in the ENVIRONMENT, not the database, and that is deliberate.
 * A database-backed login fails closed during a Supabase outage — locking the
 * operator out of their own admin during exactly the incident they need it for.
 * The auth path should not depend on the thing most likely to be broken.
 *
 * Format, one entry per operator, comma-separated:
 *   ADMIN_USERS="a@example.com:<salt>$<hash>,b@example.com:<salt>$<hash>"
 *
 * That `$` is a hazard anywhere the value passes through a docker-compose
 * `.env`, where it reads as a variable reference and deletes the hash behind it.
 * Double it to `$$` in that one context — scripts/lib/compose-env.mjs does this
 * and carries the incident notes.
 *
 * The hash is scrypt (built into Node — no new dependency, and memory-hard, so
 * unlike a bare SHA it resists the offline attack that matters if the env ever
 * leaks). Generate one with `node scripts/admin-password-hash.mjs`, which never
 * transmits or stores the password.
 */
const N = 16384, r = 8, pLen = 64; // scrypt cost; ~100ms per verify on cx53

/** One operator's stored credential. */
interface AdminUser {
  email: string;
  salt: string;
  hash: string;
}

function parseAdminUsers(): AdminUser[] {
  const raw = process.env.ADMIN_USERS || "";
  if (!raw.trim()) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      // Split on the FIRST colon only: an email cannot contain one, but a hash
      // segment might, and splitting greedily would silently corrupt it.
      const i = entry.indexOf(":");
      if (i < 0) return null;
      const email = entry.slice(0, i).trim().toLowerCase();
      const [salt, hash] = entry.slice(i + 1).split("$");
      if (!email || !salt || !hash) return null;
      return { email, salt, hash };
    })
    .filter((u): u is AdminUser => u !== null);
}

/** scrypt a password with a known salt, hex-encoded. */
export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, pLen, { N, r, p: 1 }).toString("hex");
}

/** A fresh random salt, for the hash-generating script. */
export function newSalt(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Verifies a named operator and returns their e-mail, or null.
 *
 * Returns the identity rather than a boolean because the caller needs it for the
 * session and the audit trail — a boolean would force a second lookup and invite
 * the two to disagree.
 *
 * Every candidate is checked even after a match, so the time taken does not
 * reveal WHICH account exists. A wrong e-mail and a wrong password should be
 * indistinguishable from outside.
 */
export function verifyOperator(email: string, password: string): string | null {
  if (!SECRET) return null; // misconfigured → deny, never allow
  const users = parseAdminUsers();
  if (users.length === 0) return null;

  const wanted = String(email || "").trim().toLowerCase();
  let matched: string | null = null;
  for (const u of users) {
    const candidate = hashPassword(password || "", u.salt);
    if (u.email === wanted && safeEqual(candidate, u.hash)) matched = u.email;
  }
  return matched;
}

/** Are named operators configured at all? */
export function hasNamedOperators(): boolean {
  return parseAdminUsers().length > 0;
}

/**
 * Mint a fresh signed session token valid for ADMIN_COOKIE_MAX_AGE.
 *
 * The operator's e-mail rides inside the token so every later request knows who
 * is acting without a database lookup — which keeps the audit trail honest even
 * while the database is unreachable.
 *
 * base64url, because an e-mail contains dots and the token is dot-delimited;
 * encoding it keeps the parse unambiguous rather than relying on counting from
 * the end. Omitted entirely for a legacy shared-password session, so an old
 * token stays valid and nobody is logged out by this change.
 */
export function makeSessionToken(actor?: string): string {
  const exp = Date.now() + ADMIN_COOKIE_MAX_AGE * 1000;
  const who = actor ? Buffer.from(actor).toString("base64url") : "";
  const payload = `admin.${who}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Validate a session token's signature and expiry. */
export function isValidSessionToken(token: string | undefined | null): boolean {
  return sessionActor(token) !== null;
}

/**
 * The operator this token belongs to, or null if it is not a valid session.
 *
 * Returns `""` for a valid legacy token minted before named operators existed —
 * a session that is genuine but unattributable. Distinguishing "not logged in"
 * (null) from "logged in, name unknown" ("") matters: the audit trail should
 * record the second honestly rather than inventing a name for it.
 */
export function sessionActor(token: string | undefined | null): string | null {
  if (!token || !SECRET) return null;
  const parts = token.split(".");

  // 3 parts = the pre-AD-02 format (`admin.<exp>.<sig>`). Still accepted so this
  // change does not sign everyone out mid-shift; it simply carries no name.
  if (parts.length === 3) {
    const [role, expStr, sig] = parts;
    if (!safeEqual(sig, sign(`${role}.${expStr}`))) return null;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return null;
    return role === "admin" ? "" : null;
  }

  if (parts.length !== 4) return null;
  const [role, who, expStr, sig] = parts;
  if (!safeEqual(sig, sign(`${role}.${who}.${expStr}`))) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  if (role !== "admin") return null;

  try {
    return who ? Buffer.from(who, "base64url").toString("utf8") : "";
  } catch {
    // A token whose signature verifies but whose name will not decode is not a
    // session to trust.
    return null;
  }
}

/** Gate for admin API routes — reads the httpOnly cookie off the request. */
export function requireAdmin(request: NextRequest): boolean {
  return isValidSessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
}

/**
 * Who is making this request — "" for an authenticated but unattributable
 * session, null for no session at all.
 *
 * Kept separate from `requireAdmin` so the guard stays a plain boolean at every
 * call site. A route that forgot to check identity would otherwise read exactly
 * like one that checked it and got nobody.
 */
export function adminActor(request: NextRequest): string | null {
  return sessionActor(request.cookies.get(ADMIN_COOKIE)?.value);
}
