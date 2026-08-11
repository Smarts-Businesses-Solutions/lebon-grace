#!/usr/bin/env node
/**
 * Print a service_role JWT for the EPHEMERAL CI database (TR-03).
 *
 *   node scripts/ci-service-jwt.mjs
 *
 * Used by the `lifecycle` job in .forgejo/workflows/ci.yml. The database it
 * opens is created empty at the start of the job, is reachable only from that
 * job's private network, and is destroyed when the job ends.
 *
 * Built here rather than committed as a literal, for one specific reason: a
 * committed JWT is a long base64 string that looks exactly like a real
 * credential. Secret scanners flag it, and — worse — a human skimming the repo
 * cannot tell it apart from one that matters. Generating it keeps the repo free
 * of key-shaped strings.
 *
 * The secret is the same throwaway value the workflow gives the containers. It
 * is not a secret in any meaningful sense; it is a shared constant between two
 * containers that live for eight minutes.
 */
import { createHmac } from "node:crypto";

const SECRET = process.env.CI_JWT_SECRET || "ci-ephemeral-jwt-secret-at-least-32-chars-long";

const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

// Fixed timestamps rather than Date.now(): the token is deterministic, so a
// re-run produces an identical one and nothing depends on the clock.
const header = b64u({ alg: "HS256", typ: "JWT" });
const payload = b64u({
  role: "service_role",
  iss: "supabase",
  iat: 1767225600, // 2026-01-01
  exp: 2081980800, // 2036-01-01
});
const signature = createHmac("sha256", SECRET).update(`${header}.${payload}`).digest("base64url");

process.stdout.write(`${header}.${payload}.${signature}\n`);
