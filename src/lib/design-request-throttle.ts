import { db } from "./store";

/**
 * Bound how many design requests one address can submit, across deploys.
 *
 * `rate-limit.ts` sits in front of this and is still worth having: it absorbs a
 * burst without a database round trip. But its buckets live in process memory
 * and are zeroed by every restart, which is the weakness migration 0006
 * documented for the login route. Here that matters more, not less.
 *
 * THE THREAT IS ACCUMULATION, NOT GUESSING. Nobody brute-forces a design
 * request. Someone bored submits four hundred overnight, the operator queue
 * becomes unusable, and R2's free tier runs out around a thousand objects. A
 * counter that forgets on deploy does not stop that, it spreads it across
 * deploys.
 *
 * Two windows, because they answer different questions:
 *
 *   hourly  someone hammering the form right now
 *   daily   someone drip-feeding under an hourly limit
 *
 * Both are generous for a real customer. A person sending artwork for one
 * child's puzzle submits once, twice if the first photo was blurry.
 */

const HOURLY_LIMIT = 3;
const DAILY_LIMIT = 8;

export interface SubmissionThrottleState {
  blocked: boolean;
  /** Seconds until the caller may try again. Zero when not blocked. */
  retryAfterSeconds: number;
  reason: "hourly" | "daily" | null;
}

const OPEN: SubmissionThrottleState = { blocked: false, retryAfterSeconds: 0, reason: null };

async function countSince(ip: string, since: Date): Promise<number> {
  const { count, error } = await db()
    .from("design_requests")
    .select("id", { count: "exact", head: true })
    .eq("submitter_ip", ip)
    .gte("created_at", since.toISOString());

  if (error) throw new Error(`submission throttle count failed: ${error.message}`);
  return count ?? 0;
}

/**
 * Ask whether this address may submit.
 *
 * FAILS OPEN on a database error, deliberately. If Postgres is unreachable the
 * shop is already in trouble, and refusing a genuine customer's artwork because
 * the throttle could not count is the wrong failure. The in-memory limiter in
 * front still applies, so this is not the only thing standing there.
 *
 * An unknown address is not throttled here either. Everything behind the proxy
 * would otherwise share one bucket and the first submitter would lock out the
 * rest.
 */
export async function checkSubmissionThrottle(
  ip: string,
  now: Date = new Date(),
): Promise<SubmissionThrottleState> {
  if (!ip || ip === "unknown") return OPEN;

  try {
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    if ((await countSince(ip, hourAgo)) >= HOURLY_LIMIT) {
      return { blocked: true, retryAfterSeconds: 60 * 60, reason: "hourly" };
    }

    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if ((await countSince(ip, dayAgo)) >= DAILY_LIMIT) {
      return { blocked: true, retryAfterSeconds: 24 * 60 * 60, reason: "daily" };
    }

    return OPEN;
  } catch {
    return OPEN;
  }
}

/**
 * The refusal a customer sees.
 *
 * Says what happened and when to come back, and points at a channel that still
 * works. Someone hitting this is far more likely to be a customer with a fiddly
 * photo than an attacker, and being told to email is more useful than being
 * told a limit was exceeded.
 */
export function throttledSubmissionResponse(state: SubmissionThrottleState): Response {
  const hours = Math.round(state.retryAfterSeconds / 3600);
  return new Response(
    JSON.stringify({
      error:
        `That is a few requests in a short time. Please try again in ${hours === 1 ? "an hour" : `${hours} hours`}, ` +
        `or email care@lebon-grace.com and we will pick it up from there.`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(state.retryAfterSeconds),
      },
    },
  );
}
