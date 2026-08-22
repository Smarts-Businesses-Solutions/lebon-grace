import { createHmac } from "crypto";
import { db } from "./store";

/**
 * Whether we may send a cart-recovery mail to this address (SH-06).
 *
 * The endpoint takes a recipient from the request body and sends branded mail
 * from our domain to it. That is unavoidable — the whole feature is "e-mail me
 * my cart", and a shopper who has never ordered has no prior relationship to
 * check against. So the address cannot be validated as *theirs*.
 *
 * What CAN be bounded is how often any one address is reachable, and by whom.
 * The existing control was a per-IP limit of 3/hour, which caps a single
 * attacker's throughput and does nothing at all for the victim: rotating IPs
 * costs pennies, and every one of them can mail the same person again.
 *
 * The audit rated this low **because every e-mail was being refused at the
 * time** (B-30). Fixing the sender domain made it live. That is the thing worth
 * remembering here — a dormant abuse path became reachable the moment an
 * unrelated bug was fixed, and nothing in the test suite noticed.
 *
 * Two controls, both keyed on the RECIPIENT rather than the sender:
 *
 *   1. A cooldown. One cart-recovery mail per address per 24 hours, however
 *      many IPs ask. A shopper who genuinely wants their cart twice in a day
 *      can use the site; a harasser gets one message instead of hundreds.
 *   2. Suppression. An address that has opted out is never mailed again.
 *
 * ADDRESSES ARE STORED AS A KEYED HASH, never in clear. This table exists only
 * to answer "have we mailed this address recently", which needs equality and
 * nothing else. Storing the addresses themselves would build a list of people
 * who never asked to be on one — anyone can add an address to it by POSTing —
 * and that list is exactly what should not exist. The HMAC key means a leaked
 * table cannot be reversed with a dictionary of common addresses either.
 */

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Keyed so the table is not a rainbow-table target.
 *
 * ADMIN_SESSION_SECRET is reused deliberately rather than adding another
 * variable to a 67-variable container: it is already required, already secret,
 * and rotating it invalidating these hashes is harmless — the worst case is
 * that every address becomes eligible again, which fails in the safe direction
 * (a delayed mail, not an extra one).
 */
function hashRecipient(email: string): string {
  const key = process.env.ADMIN_SESSION_SECRET || "";
  return createHmac("sha256", key).update(email.trim().toLowerCase()).digest("hex");
}

export type RecoveryDecision = "allow" | "cooldown" | "suppressed" | "unavailable";

/**
 * Ask whether this address may be mailed.
 *
 * Returns "unavailable" if the check itself fails. The caller treats that as a
 * refusal: if we cannot tell whether an address is being harassed, we do not
 * send. That is the opposite of how the rest of this codebase treats database
 * failures — order e-mails, for instance, are best-effort — and the difference
 * is deliberate. A missed cart-recovery mail costs one sale. A send we could
 * not check costs someone else's inbox.
 */
export async function mayRecover(email: string): Promise<RecoveryDecision> {
  const hash = hashRecipient(email);
  try {
    const { data, error } = await db()
      .from("cart_recovery_sends")
      .select("last_sent_at,suppressed")
      .eq("recipient_hash", hash)
      .maybeSingle();

    if (error) {
      console.error(`[cart-recovery] could not check the recipient cooldown: ${error.message}`);
      return "unavailable";
    }
    if (!data) return "allow";
    if (data.suppressed) return "suppressed";

    const last = Date.parse(data.last_sent_at);
    if (Number.isFinite(last) && Date.now() - last < COOLDOWN_MS) return "cooldown";
    return "allow";
  } catch (err) {
    console.error("[cart-recovery] could not check the recipient cooldown:", err);
    return "unavailable";
  }
}

/**
 * Never send cart recovery to this address again.
 *
 * THIS FUNCTION DID NOT EXIST, and its absence made the unsubscribe button in
 * the cart recovery e-mail incapable of working. `suppressed` was read by
 * mayRecover above and written by nothing, anywhere in the codebase. The column
 * shipped, the guard consulted it, and no code path could ever set it, so the
 * check could only ever return false. A guard that has never gone red is either
 * unnecessary or broken, and this one was broken.
 *
 * What that meant in practice: cart recovery is promotional mail sent to people
 * who typed an address at checkout and did not buy. They never asked for it. It
 * carries a one-click unsubscribe, Gmail and Yahoo show the native Unsubscribe
 * button beside the sender, someone presses it, and the next abandoned cart
 * mails them again. email.ts warns in its own comments that a button which does
 * nothing teaches recipients to press "report spam" instead, and complaints are
 * what actually damage a sending domain.
 *
 * Upsert rather than update: the address may never have been sent to, and an
 * unsubscribe from someone with no row must still be recorded. That is the
 * whole point of honouring it before rather than after the first send.
 */
export async function suppressRecovery(email: string): Promise<void> {
  const hash = hashRecipient(email);
  try {
    const { error } = await db().from("cart_recovery_sends").upsert(
      {
        recipient_hash: hash,
        suppressed: true,
        // Not a send. Left at its default for a new row and untouched for an
        // existing one, so send_count stays a count of messages actually sent.
      },
      { onConflict: "recipient_hash" },
    );
    if (error) console.error(`[cart-recovery] could not suppress: ${error.message}`);
  } catch (err) {
    // Swallowed, like the rest of this module. The caller is an unsubscribe
    // endpoint that must answer 200 to a mail provider whatever happens here:
    // a provider seeing an error may retry, or decide the header is unreliable
    // and stop showing the button at all.
    console.error("[cart-recovery] could not suppress:", err);
  }
}

/** Record a send, so the next request for this address is refused. */
export async function recordRecoverySend(email: string): Promise<void> {
  const hash = hashRecipient(email);
  try {
    // Read-then-write rather than a bare upsert, so `send_count` accumulates —
    // an address being repeatedly targeted is worth being able to see, even
    // though the address itself is not stored.
    const { data } = await db()
      .from("cart_recovery_sends")
      .select("send_count")
      .eq("recipient_hash", hash)
      .maybeSingle();

    const { error } = await db().from("cart_recovery_sends").upsert(
      {
        recipient_hash: hash,
        last_sent_at: new Date().toISOString(),
        send_count: (data?.send_count ?? 0) + 1,
      },
      { onConflict: "recipient_hash" }
    );
    if (error) console.error(`[cart-recovery] could not record the send: ${error.message}`);
  } catch (err) {
    console.error("[cart-recovery] could not record the send:", err);
  }
}
