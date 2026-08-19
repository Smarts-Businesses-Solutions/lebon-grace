import { randomInt } from "node:crypto";
import { db } from "./store";

/**
 * Reads and writes for the custom design conversation.
 *
 * Kept out of `store.ts` for the reason stated there: that file is the
 * `orders`/`products` API surface, and a design request is not shop data yet.
 * It becomes shop data only when the customer buys, at which point `order_id`
 * links the two.
 *
 * Schema in supabase/migrations/0012_design_requests.sql.
 */

export type DesignRequestStatus =
  | "submitted"
  | "discussing"
  | "approved"
  | "ordered"
  | "declined"
  | "expired";

/**
 * The only statuses an operator may set by hand.
 *
 * "submitted" is where a row starts, "ordered" is written by the order path and
 * "expired" by the sweep. Letting the admin write those makes the status mean
 * whatever was last clicked.
 *
 * Exported so the API route and the admin panel read the SAME list. The orders
 * side of this codebase learned that the hard way: ORDER_STATUSES in the admin
 * page was a verbatim copy of the settable list, correct only by attention, and
 * `cancelled` went missing from the dropdown for months while having full email
 * and WhatsApp copy behind it. One list, imported twice.
 */
export const OPERATOR_SETTABLE_STATUSES = ["discussing", "approved", "declined"] as const;

export type OperatorSettableStatus = (typeof OPERATOR_SETTABLE_STATUSES)[number];

/** A row as PostgREST returns it. Nullability mirrors the database. */
export interface DesignRequestRow {
  id: string;
  reference: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  brief: string;
  artwork_key: string | null;
  artwork_type: string | null;
  artwork_bytes: number | null;
  status: DesignRequestStatus;
  order_id: string | null;
  expires_at: string;
  operator_note: string | null;
  submitter_ip: string | null;
  [key: string]: unknown;
}

/**
 * The reference the customer and the operator say to each other.
 *
 * Deliberately not a uuid: nobody reads a uuid down a phone or types one into
 * WhatsApp. Deliberately not sequential either, because a running counter
 * publishes how many requests the shop has ever had, and at zero customers
 * that is not a number worth broadcasting.
 *
 * The alphabet omits 0/O and 1/I/L. Those are the pairs people mishear and
 * mistype, and every one of them costs the operator a round trip to find the
 * right row.
 *
 * randomInt, not Math.random: this is a lookup handle for someone else's
 * photographs, so it should not be predictable from a previous one.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateReference(): string {
  let out = "LG-";
  for (let i = 0; i < 6; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export interface NewDesignRequest {
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  brief: string;
  /**
   * The address that submitted this. Personal data, stored for one narrow
   * purpose: bounding how many requests one source can file. See
   * design-request-throttle.ts and migration 0013. Cleared with the artwork.
   */
  submitterIp?: string | null;
}

/**
 * Create the row BEFORE the artwork is stored.
 *
 * Order matters. The row records that someone submitted something, even if the
 * file is then rejected by the sanitiser, which is what makes a flood of bad
 * uploads visible instead of silent. `artwork_key` stays null until bytes are
 * actually in R2 under a key we chose.
 *
 * Retries on a reference collision rather than trusting six random characters
 * to be unique forever. The unique index is the real guarantee; this just makes
 * the rare collision invisible to the customer.
 */
export async function createDesignRequest(input: NewDesignRequest): Promise<DesignRequestRow> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db()
      .from("design_requests")
      .insert({
        reference: generateReference(),
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone ?? null,
        brief: input.brief,
        submitter_ip: input.submitterIp ?? null,
      })
      .select()
      .single();

    if (!error) return data as DesignRequestRow;
    // 23505 is unique_violation. Anything else is a real failure.
    if (error.code !== "23505") throw new Error(`design request insert failed: ${error.message}`);
  }
  throw new Error("could not allocate a unique design request reference");
}

/**
 * Record where the artwork landed.
 *
 * Called only after the bytes are in R2, so the row never points at an object
 * that does not exist. The type stored is the one we determined by decoding,
 * never the one the browser claimed.
 */
export async function attachArtwork(
  id: string,
  artwork: { key: string; contentType: string; bytes: number },
): Promise<void> {
  const { error } = await db()
    .from("design_requests")
    .update({
      artwork_key: artwork.key,
      artwork_type: artwork.contentType,
      artwork_bytes: artwork.bytes,
    })
    .eq("id", id);

  if (error) throw new Error(`attaching artwork failed: ${error.message}`);
}

/** For the customer checking on their own request, and for the operator. */
export async function getByReference(reference: string): Promise<DesignRequestRow | null> {
  const { data, error } = await db()
    .from("design_requests")
    .select()
    .eq("reference", reference)
    .maybeSingle();

  if (error) throw new Error(`design request lookup failed: ${error.message}`);
  return (data as DesignRequestRow) ?? null;
}

/**
 * The operator queue: everything still needing a human, oldest first.
 *
 * Excludes the terminal states. A request that is ordered, declined or expired
 * is history, and history belongs in a search rather than a work queue.
 */
export async function listOpenRequests(limit = 100): Promise<DesignRequestRow[]> {
  const { data, error } = await db()
    .from("design_requests")
    .select()
    .in("status", ["submitted", "discussing", "approved"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`design request list failed: ${error.message}`);
  return (data ?? []) as DesignRequestRow[];
}

export async function setStatus(
  id: string,
  status: DesignRequestStatus,
  operatorNote?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (operatorNote !== undefined) patch.operator_note = operatorNote;

  const { error } = await db().from("design_requests").update(patch).eq("id", id);
  if (error) throw new Error(`design request status update failed: ${error.message}`);
}

/** Called once the customer has actually bought. */
export async function linkOrder(id: string, orderId: string): Promise<void> {
  const { error } = await db()
    .from("design_requests")
    .update({ order_id: orderId, status: "ordered" })
    .eq("id", id);

  if (error) throw new Error(`linking order to design request failed: ${error.message}`);
}

/**
 * Rows whose artwork is past its date and still stored.
 *
 * The sweep deletes the R2 object and then marks the row expired. It asks only
 * for rows that still hold a key, which is what the partial index in migration
 * 0012 exists for, and it never touches a row already marked expired so a
 * failed run can simply be repeated.
 */
export async function findExpiredArtwork(limit = 200): Promise<DesignRequestRow[]> {
  const { data, error } = await db()
    .from("design_requests")
    .select()
    .lt("expires_at", new Date().toISOString())
    .not("artwork_key", "is", null)
    .neq("status", "expired")
    .limit(limit);

  if (error) throw new Error(`expired artwork lookup failed: ${error.message}`);
  return (data ?? []) as DesignRequestRow[];
}

/**
 * Forget the artwork, keep the conversation.
 *
 * Clears the pointer and the derived metadata rather than deleting the row. The
 * request still happened and the operator note may still matter; what goes is
 * the customer's photograph, which is the part we have no business keeping once
 * it has expired.
 */
export async function clearArtwork(id: string, status: DesignRequestStatus = "expired"): Promise<void> {
  const { error } = await db()
    .from("design_requests")
    .update({
      artwork_key: null,
      artwork_type: null,
      artwork_bytes: null,
      // The address goes with the photograph. It was kept to bound submissions,
      // and once the artwork is gone there is nothing left to bound.
      submitter_ip: null,
      status,
    })
    .eq("id", id);

  if (error) throw new Error(`clearing artwork failed: ${error.message}`);
}
