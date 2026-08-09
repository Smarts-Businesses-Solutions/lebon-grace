/**
 * Admin login throttle that survives a restart.
 *
 * ACTION_PLAN.md A-21, finding S-3. `rate-limit.ts` holds its buckets in process
 * memory, which is a reasonable choice for ordinary routes on a single-container
 * app — but it means **every deploy resets every counter**. With eight deploys in
 * a day, an attacker does not have to defeat "5 attempts per 15 minutes"; they
 * only have to still be running when someone ships.
 *
 * This layer sits behind the in-memory one, not instead of it:
 *
 *   in-memory   absorbs bursts with no database round trip
 *   this table  remembers across restarts, which is the part memory cannot do
 *
 * Only FAILURES count. A success clears the address, so an admin who mistypes
 * three times and then gets in is not locked out of their own shop afterwards.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** Failures allowed from one address inside the window before it is refused. */
export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;
/** Attempts older than this are pruned; nothing reads them. */
const RETENTION_MS = 24 * 60 * 60 * 1000;

let _client: SupabaseClient | null = null;
function db(): SupabaseClient | null {
  if (_client) return _client;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  _client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export interface ThrottleState {
  blocked: boolean;
  failures: number;
  retryAfterSeconds: number;
}

/**
 * How many failures this address has inside the window, and whether that is
 * already too many.
 *
 * **Fails open, loudly.** If Postgres cannot be reached this returns "not
 * blocked" rather than locking the operator out of their own admin during an
 * outage — the in-memory limiter is still in front of it, so protection
 * degrades rather than disappearing. The alternative, failing closed, turns a
 * database blip into "nobody can administer the shop", which is a worse outage
 * than the one it would be protecting against.
 */
export async function checkLoginThrottle(ip: string, now: Date = new Date()): Promise<ThrottleState> {
  const client = db();
  const open: ThrottleState = { blocked: false, failures: 0, retryAfterSeconds: 0 };
  if (!client || !ip || ip === "unknown") return open;

  const since = new Date(now.getTime() - WINDOW_MS).toISOString();
  const { data, error } = await client
    .from("login_attempts")
    .select("attempted_at")
    .eq("ip", ip)
    .eq("succeeded", false)
    .gte("attempted_at", since)
    .order("attempted_at", { ascending: true });

  if (error) {
    console.error("[login-throttle] could not read attempts — failing OPEN:", error.message);
    return open;
  }

  const failures = data?.length || 0;
  if (failures < MAX_FAILURES) return { blocked: false, failures, retryAfterSeconds: 0 };

  // The window slides from the OLDEST failure still inside it, so the block
  // expires as that attempt ages out rather than being extended by every
  // subsequent rejected request. Otherwise a bot hammering the endpoint would
  // keep resetting its own sentence and lock the address out permanently.
  const oldest = new Date(String(data[0].attempted_at)).getTime();
  const retryAfterSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MS - now.getTime()) / 1000));
  return { blocked: true, failures, retryAfterSeconds };
}

/**
 * Record an attempt. A success also clears that address's failures.
 *
 * Never throws: failing to write an audit row must not stop a legitimate admin
 * from logging in.
 */
export async function recordLoginAttempt(ip: string, succeeded: boolean, now: Date = new Date()): Promise<void> {
  const client = db();
  if (!client || !ip || ip === "unknown") return;

  try {
    await client.from("login_attempts").insert({ ip, succeeded, attempted_at: now.toISOString() });

    if (succeeded) {
      // Getting in proves the person is who they say they are; holding their
      // earlier typos against them serves nobody.
      await client.from("login_attempts").delete().eq("ip", ip).eq("succeeded", false);
    }

    // Opportunistic prune. There is no scheduler in this estate, so the cheapest
    // reliable place to do this is on the rare path that already writes.
    await client
      .from("login_attempts")
      .delete()
      .lt("attempted_at", new Date(now.getTime() - RETENTION_MS).toISOString());
  } catch (err) {
    console.error("[login-throttle] could not record attempt:", err instanceof Error ? err.message : err);
  }
}

/** The 429 to return when an address is blocked. */
export function throttledResponse(state: ThrottleState): Response {
  return new Response(JSON.stringify({ error: "Too many failed attempts. Try again later." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(state.retryAfterSeconds),
    },
  });
}
