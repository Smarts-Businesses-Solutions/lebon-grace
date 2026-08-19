import { NextRequest, NextResponse } from "next/server";
import { subscribers } from "@/lib/store";
import { rateLimit } from "@/lib/rate-limit";
import { isDeliverableEmail } from "@/lib/email-address";
import { deliver, fromAddress } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";


/**
 * Newsletter signup.
 *
 * The previous version of this had no server side at all. The homepage ran
 * `setSubscribed(true)` and showed "You're subscribed! Check your inbox for a
 * welcome offer." Nothing was stored, nothing was sent, and there was no
 * welcome offer. Every address anyone typed was dropped on the floor.
 *
 * This stores the address so the list actually exists. It deliberately does not
 * send a welcome mail, because there is no welcome offer to send yet.
 */
export async function POST(request: NextRequest) {
  // Writes a row per call, so it needs a ceiling. Five an hour per IP is far
  // more than a person subscribing once will ever need.
  const limited = rateLimit(request, { key: "newsletter", limit: 5, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const { email, website } = body as Record<string, string>;

  // Honeypot, same as the contact form: hidden from people, filled by bots.
  // A bot gets a 200 and no row, so it does not learn to try again differently.
  if (website) return NextResponse.json({ success: true });

  if (!email || !isDeliverableEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }

  /*
   * Store as PENDING and ask the address to confirm itself (NS-01).
   *
   * This used to add the address outright, so anyone could subscribe anyone —
   * a stranger's address, a competitor's, an ex-partner's — and the only remedy
   * was an unsubscribe link the victim could not use until the mail had already
   * arrived. It mattered less while nothing was delivered (B-30); it matters now.
   */
  let token: string | null;
  try {
    token = await subscribers.add(email, "homepage");
  } catch (err) {
    console.error("newsletter signup failed", err);
    return NextResponse.json({ error: "Could not save your address. Please try again." }, { status: 500 });
  }

  /*
   * The SAME answer whether the address is new, already pending, or already
   * confirmed.
   *
   * `add` returns null for an address already on the list, and saying so would
   * turn this endpoint into a membership oracle: type an address, learn whether
   * that person subscribed. The unsubscribe route already refuses to leak that,
   * and this must match it.
   */
  if (token) {
    const url = `${getAppUrl()}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
    // Fire-and-forget: the row exists, and a mail outage must not tell the
    // visitor their signup failed when it did not. A refusal is logged by
    // `deliver` with the provider's own reason (B-30).
    void deliver("newsletter-confirm", {
      from: fromAddress(),
      to: [email.trim()],
      subject: "Confirm your Lebon Grace subscription",
      html:
        `<p>Someone, hopefully you, asked for occasional news from Lebon Grace.</p>` +
        `<p><a href="${url}">Confirm your subscription</a></p>` +
        `<p style="color:#666;font-size:13px;">If it was not you, ignore this message. ` +
        `Nothing will be sent to this address unless the link above is used.</p>`,
    }).catch((err) => console.error("[newsletter-confirm] unexpected throw:", err));
  }

  return NextResponse.json({ success: true });
}
