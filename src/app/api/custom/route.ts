import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { checkSubmissionThrottle, throttledSubmissionResponse } from "@/lib/design-request-throttle";
import { createDesignRequest, attachArtwork } from "@/lib/design-requests";
import { sanitiseArtwork, MAX_ARTWORK_BYTES, REJECTION_MESSAGE } from "@/lib/artwork";
import { artworkKey, putArtwork } from "@/lib/artwork-storage";
import { CONTACT } from "@/lib/contact";
import { fromAddress, esc, deliver } from "@/lib/email";
import { isDeliverableEmail } from "@/lib/email-address";

/**
 * Custom design request: artwork and a brief, before any money changes hands.
 *
 * This is the shop's only unauthenticated endpoint that accepts a file, so the
 * order of operations below is the security design and not an accident.
 *
 *   1. in-memory limiter      absorbs a burst with no database round trip
 *   2. honeypot               a bot that fills it gets 200 and no row
 *   3. field validation       before anything expensive
 *   4. database throttle      bounds accumulation ACROSS deploys
 *   5. create the row         so a later rejection is still recorded
 *   6. sanitise the file      decode and re-encode, the actual guarantee
 *   7. store, then attach     the row never points at an object that is absent
 *   8. tell the operator      last, because it must not block the customer
 *
 * Steps 1 and 4 are both present on purpose. The in-memory one is fast and
 * forgets everything on deploy; the database one is slower and does not.
 *
 * There is no payment here and no order. Photo and logo work is agreed with the
 * customer first, and only then do they check out at the ordinary AED 15.
 */

/**
 * Runs per request. The route reads the client address and writes to Postgres
 * and R2, none of which can be prerendered, and a cached response would hand
 * one customer another customer's reference.
 */
export const dynamic = "force-dynamic";

/** Generous for a real customer, useless to a script. */
const BRIEF_MAX = 2000;
const NAME_MAX = 120;

export async function POST(request: NextRequest) {
  // Burst absorber. The database throttle below is the one that survives a
  // deploy, but there is no reason to reach Postgres for the tenth request in
  // ten seconds from the same address.
  const limited = rateLimit(request, { key: "custom-design", limit: 5, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  const ip = clientIp(request);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    // Not multipart, or truncated mid-upload. Either way there is nothing to read.
    return NextResponse.json({ error: "We could not read that submission." }, { status: 400 });
  }

  const field = (k: string) => String(form.get(k) ?? "").trim();
  const name = field("name").slice(0, NAME_MAX);
  const email = field("email");
  const phone = field("phone") || null;
  const brief = field("brief").slice(0, BRIEF_MAX);

  // Hidden from people, irresistible to bots. A cheerful 200 and no row, so the
  // bot does not learn it was caught and retry differently. Same trick as
  // /api/contact.
  if (field("website")) return NextResponse.json({ success: true });

  if (!name || !email || !brief) {
    return NextResponse.json(
      { error: "Please give us your name, an email address, and a line about what you would like." },
      { status: 400 },
    );
  }

  if (!isDeliverableEmail(email)) {
    // The whole flow is a conversation. An address we cannot reach makes the
    // request worthless to both sides, so it is worth refusing early.
    return NextResponse.json(
      { error: "That email address does not look reachable. We need it to send you the design." },
      { status: 400 },
    );
  }

  const file = form.get("artwork");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Please attach the photo or logo you would like engraved." }, { status: 400 });
  }

  // Cheapest possible rejection of an oversized upload. The real check is on the
  // buffer in sanitiseArtwork, because a chunked request can misreport size.
  if (file.size > MAX_ARTWORK_BYTES) {
    return NextResponse.json({ error: REJECTION_MESSAGE["too-large"] }, { status: 413 });
  }

  const throttle = await checkSubmissionThrottle(ip);
  if (throttle.blocked) return throttledSubmissionResponse(throttle);

  /*
   * The row is created BEFORE the file is validated, deliberately.
   *
   * A rejected upload still leaves a record that someone submitted something.
   * That is what makes a flood visible: without it, an attacker sending
   * hundreds of malformed files produces no trace at all, and the throttle in
   * front of this has nothing to count.
   */
  const requestRow = await createDesignRequest({
    customerName: name,
    customerEmail: email,
    customerPhone: phone,
    brief,
    submitterIp: ip,
  });

  const raw = Buffer.from(await file.arrayBuffer());
  const clean = await sanitiseArtwork(raw);

  if (!clean.ok) {
    // The row stays, holding no artwork key. The customer gets a specific,
    // non-technical reason and can try again with a different file.
    return NextResponse.json(
      { error: REJECTION_MESSAGE[clean.reason], reference: requestRow.reference },
      { status: 415 },
    );
  }

  const key = artworkKey(requestRow.reference);
  await putArtwork(key, clean.buffer, clean.contentType);
  await attachArtwork(requestRow.id, {
    key,
    contentType: clean.contentType,
    bytes: clean.bytes,
  });

  /*
   * Telling the operator is the LAST step and its failure is not the
   * customer's problem.
   *
   * The artwork is already stored and the row already exists, so the request is
   * not lost if Resend is down. It will simply sit in the queue at /admin until
   * someone looks, which is the same place it would have gone anyway.
   */
  void deliver("custom-design", {
    from: fromAddress(),
    to: [CONTACT.email],
    replyTo: email,
    subject: `Custom design request ${requestRow.reference} from ${name}`,
    html:
      `<p><strong>${esc(name)}</strong> has sent artwork for a custom piece.</p>` +
      `<p>Reference: <strong>${esc(requestRow.reference)}</strong></p>` +
      `<p>Email: ${esc(email)}<br>Phone: ${esc(phone ?? "not given")}</p>` +
      `<p><strong>What they asked for</strong><br>${esc(brief).replace(/\n/g, "<br>")}</p>` +
      `<p>Artwork is attached to the request in the admin queue. It is not ` +
      `included here, because customer photographs should not sit in a mailbox.</p>`,
  });

  return NextResponse.json({
    success: true,
    reference: requestRow.reference,
    message:
      "Thank you. We will look at your artwork and come back to you to agree the design " +
      "before anything is cut.",
  });
}
